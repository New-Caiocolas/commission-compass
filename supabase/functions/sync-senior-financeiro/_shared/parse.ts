// Parsing da resposta do web service customizado com.ello.metrics/ConsultarFinanceiro.
//
// Formato real confirmado (Salvar resposta / XML, 2026-07-20):
//   <response service='com.ello.metrics' port='ConsultarFinanceiro'>
//     <params>
//       <prError></prError>
//       <Resultado>
//         <line>
//           <numTit>19042022F-01</numTit>
//           <parceiro isnull='1'/>                 <- campo nulo = atributo isnull
//           <valor>170,07</valor>                  <- decimal BR (vírgula)
//           <dataEmissao>19/04/2022</dataEmissao>  <- data DD/MM/AAAA
//           <situacao>LQ</situacao>                 <- AB = aberto, LQ = liquidado
//           ...
// Os nomes dos campos são os das colunas da porta (definidas por nós), então o
// mapeamento é direto. Encoding do envelope é ISO-8859-1.

import { XMLParser } from "npm:fast-xml-parser@4.4.1";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
});

export function parseSoapXml(xml: string): unknown {
  return parser.parse(xml);
}

/** Procura recursivamente o primeiro array não-vazio de objetos (os <line>). */
export function findRecordArray(node: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(node)) {
    if (node.length > 0 && typeof node[0] === "object" && node[0] !== null) {
      return node as Record<string, unknown>[];
    }
    return null;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = findRecordArray(value);
      if (found) return found;
    }
  }
  return null;
}

/** Busca recursiva por uma chave cujo nome bate com o regex (usada p/ mensagens de erro). */
export function findValueByKeyPattern(node: unknown, pattern: RegExp): string | null {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (pattern.test(key) && (typeof value === "string" || typeof value === "number")) {
        return String(value);
      }
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = findValueByKeyPattern(value, pattern);
      if (found) return found;
    }
  } else if (Array.isArray(node)) {
    for (const item of node) {
      const found = findValueByKeyPattern(item, pattern);
      if (found) return found;
    }
  }
  return null;
}

export interface MappedTitulo {
  /** codEmp do Senior (10=Ello, 30=Faz do Brasil, 20=Imperatriz), para atribuir a empresa. */
  senior_codigo_empresa: number | null;
  senior_titulo: string;
  parceiro: string | null;
  valor: number;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
  centro_custo: string | null;
  raw_payload: Record<string, unknown>;
}

/**
 * Lê o valor de um campo <line>. Um campo nulo vem como `<x isnull='1'/>`, que o
 * parser transforma num objeto (só atributos) — tratamos como null. CDATA e texto
 * viram string; números "puros" (ex.: 60) podem vir como number.
 */
function fieldValue(record: Record<string, unknown>, key: string): string | null {
  let v = record[key];
  if (v === undefined) {
    // Alguns campos vêm com case diferente (ex.: <CodEmp> vs numTit) — busca case-insensitive.
    const found = Object.keys(record).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found) v = record[found];
  }
  if (v == null) return null;
  if (typeof v === "object") return null; // <tag isnull='1'/> ou elemento vazio
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Converte o valor numérico. A tela de teste devolve formato BR ("170,07");
 * a resposta SOAP (tipo double no XSD) pode devolver "170.07". Detecta pela
 * vírgula: se houver, é BR (ponto = milhar); senão, já é decimal com ponto.
 */
function parseBrNumber(s: string | null): number {
  if (!s) return 0;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Data DD/MM/AAAA -> ISO YYYY-MM-DD (formato aceito pelo Postgres/date). */
function parseBrDate(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export interface MappedFaturamento {
  senior_codigo_empresa: number | null;
  ano: number;
  mes: number;
  valor_total: number;
  qtd_notas: number;
  impostos: number;
  deducoes: number;
}

/**
 * Registro da porta ConsultarFaturamento (agregado por DIA no Senior, o chamador
 * agrega dia -> mês). Além do valor bruto, traz impostos e deduções para a DRE.
 */
export function mapFaturamentoRecord(record: Record<string, unknown>): MappedFaturamento {
  const codEmpRaw = fieldValue(record, "codEmp");
  const dia = parseBrDate(fieldValue(record, "dataDia")); // -> YYYY-MM-DD
  return {
    senior_codigo_empresa: codEmpRaw ? Number(codEmpRaw) || null : null,
    ano: dia ? Number(dia.slice(0, 4)) : 0,
    mes: dia ? Number(dia.slice(5, 7)) : 0,
    valor_total: parseBrNumber(fieldValue(record, "valorTotal")),
    qtd_notas: Number(fieldValue(record, "qtdNotas")) || 0,
    impostos: parseBrNumber(fieldValue(record, "impostos")),
    deducoes: parseBrNumber(fieldValue(record, "deducoes")),
  };
}

export interface MappedCmv {
  senior_codigo_empresa: number | null;
  ano: number;
  mes: number;
  valor: number;
}

/** Registro da porta ConsultarCMV (custo das saídas de venda, por empresa/dia). */
export function mapCmvRecord(record: Record<string, unknown>): MappedCmv {
  const codEmpRaw = fieldValue(record, "codEmp");
  const dia = parseBrDate(fieldValue(record, "dataDia"));
  return {
    senior_codigo_empresa: codEmpRaw ? Number(codEmpRaw) || null : null,
    ano: dia ? Number(dia.slice(0, 4)) : 0,
    mes: dia ? Number(dia.slice(5, 7)) : 0,
    valor: parseBrNumber(fieldValue(record, "cmv")),
  };
}

export function mapRecord(record: Record<string, unknown>): MappedTitulo {
  const codEmpRaw = fieldValue(record, "codEmp");
  return {
    senior_codigo_empresa: codEmpRaw ? Number(codEmpRaw) || null : null,
    senior_titulo: fieldValue(record, "numTit") ?? crypto.randomUUID(),
    parceiro: fieldValue(record, "parceiro"),
    valor: parseBrNumber(fieldValue(record, "valor")),
    data_emissao: parseBrDate(fieldValue(record, "dataEmissao")),
    data_vencimento: parseBrDate(fieldValue(record, "dataVencimento")),
    data_pagamento: parseBrDate(fieldValue(record, "dataPagamento")),
    status: fieldValue(record, "situacao"),
    centro_custo: fieldValue(record, "centroCusto"),
    raw_payload: record,
  };
}
