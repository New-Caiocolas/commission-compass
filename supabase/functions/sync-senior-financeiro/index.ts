// Sincroniza dados financeiros do Senior XT para o Supabase, via web service
// customizado com.ello.metrics. Três portas (cada uma tolerante a falha — se a
// porta ainda não existir no serviço, loga o erro e segue para a próxima):
//
//   ConsultarFinanceiro      -> financeiro_contas_pagar    (snapshot: delete+insert)
//   ConsultarContasReceber   -> financeiro_contas_receber  (snapshot: delete+insert)
//   ConsultarFaturamento     -> financeiro_faturamento     (upsert por empresa/ano/mes)
//
// Cada linha vem com codEmp (10=Ello, 30=Faz do Brasil, 20=Imperatriz) para
// atribuir a empresa. Config nos secrets SENIOR_ENDPOINT/USER/PASSWORD.

import { createClient } from "npm:@supabase/supabase-js@2";
import { callPorta, loadMetricsConfig, type MetricsConfig } from "./_shared/soap.ts";
import {
  findRecordArray,
  findValueByKeyPattern,
  mapCmvRecord,
  mapFaturamentoRecord,
  mapRecord,
  parseSoapXml,
} from "./_shared/parse.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

type Supabase = ReturnType<typeof supabaseAdmin>;

/** Chama a porta, valida erroExecucao e devolve os registros mapeáveis. */
async function fetchRegistros(cfg: MetricsConfig, operacao: string) {
  const xml = await callPorta(cfg, operacao);
  const parsed = parseSoapXml(xml);
  const erro = findValueByKeyPattern(parsed, /erroExecucao/i);
  if (erro && erro.trim() !== "") {
    throw new Error(`erroExecucao (${operacao}): ${erro}`);
  }
  return findRecordArray(parsed) ?? [];
}

/** Snapshot de títulos (pagar/receber): delete por empresa + insert em lotes. */
async function syncTitulos(
  supabase: Supabase,
  cfg: MetricsConfig,
  operacao: string,
  tabela: "financeiro_contas_pagar" | "financeiro_contas_receber",
  campoParceiro: "fornecedor" | "cliente",
  empresaIdByCodEmp: Map<number, string>,
) {
  const registros = await fetchRegistros(cfg, operacao);
  const syncedAt = new Date().toISOString();
  let semEmpresa = 0;

  const rows = [];
  for (const r of registros) {
    const mapped = mapRecord(r);
    const empresaId = mapped.senior_codigo_empresa != null
      ? empresaIdByCodEmp.get(mapped.senior_codigo_empresa)
      : undefined;
    if (!empresaId) {
      semEmpresa++;
      continue;
    }
    rows.push({
      empresa_id: empresaId,
      senior_titulo: mapped.senior_titulo,
      [campoParceiro]: mapped.parceiro,
      valor: mapped.valor,
      data_emissao: mapped.data_emissao,
      data_vencimento: mapped.data_vencimento,
      data_pagamento: mapped.data_pagamento,
      status: mapped.status,
      centro_custo: mapped.centro_custo,
      synced_at: syncedAt,
    });
  }

  if (rows.length > 0) {
    const empresaIds = [...new Set(rows.map((r) => r.empresa_id))];
    const { error: delError } = await supabase.from(tabela).delete().in("empresa_id", empresaIds);
    if (delError) throw delError;

    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase.from(tabela).insert(rows.slice(i, i + BATCH));
      if (error) throw error;
    }
  }

  return { recebidos: registros.length, gravados: rows.length, sem_empresa: semEmpresa };
}

/**
 * Faturamento: a porta devolve totais por DIA (limitação do GROUP BY no Senior
 * SQL 2); agregamos aqui para mês e fazemos upsert por (empresa, ano, mes).
 */
async function syncFaturamento(
  supabase: Supabase,
  cfg: MetricsConfig,
  empresaIdByCodEmp: Map<number, string>,
) {
  const registros = await fetchRegistros(cfg, "ConsultarFaturamento");
  const syncedAt = new Date().toISOString();
  let semEmpresa = 0;

  const porMes = new Map<string, {
    empresa_id: string;
    ano: number;
    mes: number;
    valor_total: number;
    qtd_notas: number;
    impostos: number;
    deducoes: number;
  }>();

  for (const r of registros) {
    const mapped = mapFaturamentoRecord(r);
    const empresaId = mapped.senior_codigo_empresa != null
      ? empresaIdByCodEmp.get(mapped.senior_codigo_empresa)
      : undefined;
    if (!empresaId || !mapped.ano || !mapped.mes) {
      semEmpresa++;
      continue;
    }
    const chave = `${empresaId}|${mapped.ano}|${mapped.mes}`;
    const acc = porMes.get(chave) ?? {
      empresa_id: empresaId,
      ano: mapped.ano,
      mes: mapped.mes,
      valor_total: 0,
      qtd_notas: 0,
      impostos: 0,
      deducoes: 0,
    };
    acc.valor_total += mapped.valor_total;
    acc.qtd_notas += mapped.qtd_notas;
    acc.impostos += mapped.impostos;
    acc.deducoes += mapped.deducoes;
    porMes.set(chave, acc);
  }

  const cent = (n: number) => Math.round(n * 100) / 100;
  const rows = [...porMes.values()].map((r) => ({
    ...r,
    valor_total: cent(r.valor_total),
    impostos: cent(r.impostos),
    deducoes: cent(r.deducoes),
    synced_at: syncedAt,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("financeiro_faturamento")
      .upsert(rows, { onConflict: "empresa_id,ano,mes" });
    if (error) throw error;
  }

  return { recebidos: registros.length, gravados: rows.length, sem_empresa: semEmpresa };
}

/** CMV: custo das saídas de venda (E210MVP), agregado por empresa/mês. */
async function syncCmv(
  supabase: Supabase,
  cfg: MetricsConfig,
  empresaIdByCodEmp: Map<number, string>,
) {
  const registros = await fetchRegistros(cfg, "ConsultarCMV");
  const syncedAt = new Date().toISOString();
  let semEmpresa = 0;

  const porMes = new Map<string, { empresa_id: string; ano: number; mes: number; valor: number }>();
  for (const r of registros) {
    const mapped = mapCmvRecord(r);
    const empresaId = mapped.senior_codigo_empresa != null
      ? empresaIdByCodEmp.get(mapped.senior_codigo_empresa)
      : undefined;
    if (!empresaId || !mapped.ano || !mapped.mes) {
      semEmpresa++;
      continue;
    }
    const chave = `${empresaId}|${mapped.ano}|${mapped.mes}`;
    const acc = porMes.get(chave) ?? { empresa_id: empresaId, ano: mapped.ano, mes: mapped.mes, valor: 0 };
    acc.valor += mapped.valor;
    porMes.set(chave, acc);
  }

  const rows = [...porMes.values()].map((r) => ({
    ...r,
    valor: Math.round(r.valor * 100) / 100,
    synced_at: syncedAt,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("financeiro_cmv")
      .upsert(rows, { onConflict: "empresa_id,ano,mes" });
    if (error) throw error;
  }

  return { recebidos: registros.length, gravados: rows.length, sem_empresa: semEmpresa };
}

const ETAPAS = ["contaspagar", "contasreceber", "faturamento", "cmv"] as const;
type Etapa = (typeof ETAPAS)[number];

async function runEtapa(
  etapa: Etapa,
  supabase: Supabase,
  cfg: MetricsConfig,
  empresaIdByCodEmp: Map<number, string>,
) {
  switch (etapa) {
    case "contaspagar":
      return await syncTitulos(supabase, cfg, "ConsultarFinanceiro", "financeiro_contas_pagar", "fornecedor", empresaIdByCodEmp);
    case "contasreceber":
      return await syncTitulos(supabase, cfg, "ConsultarContasReceber", "financeiro_contas_receber", "cliente", empresaIdByCodEmp);
    case "faturamento":
      return await syncFaturamento(supabase, cfg, empresaIdByCodEmp);
    case "cmv":
      return await syncCmv(supabase, cfg, empresaIdByCodEmp);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = supabaseAdmin();
  const etapaParam = new URL(req.url).searchParams.get("stage") as Etapa | null;

  // ── Modo etapa única: processa uma etapa nesta execução ──────────────────
  // Cada etapa roda num worker próprio (memória isolada) para não estourar o
  // limite de recursos — 3 etapas na mesma execução deram WORKER_RESOURCE_LIMIT.
  if (etapaParam && ETAPAS.includes(etapaParam)) {
    let cfg;
    try {
      cfg = loadMetricsConfig();
    } catch (err) {
      return jsonResponse({ error: (err as Error).message }, 400);
    }

    const { data: empresasDb, error: empresasErr } = await supabase
      .from("financeiro_empresas")
      .select("id, codigo, senior_codigo_empresa");
    if (empresasErr) {
      return jsonResponse({ error: empresasErr.message }, 500);
    }
    const empresaIdByCodEmp = new Map<number, string>();
    for (const e of empresasDb) {
      if (e.senior_codigo_empresa != null) empresaIdByCodEmp.set(e.senior_codigo_empresa, e.id);
    }

    try {
      const r = await runEtapa(etapaParam, supabase, cfg, empresaIdByCodEmp);
      await supabase.from("financeiro_sync_log").insert({
        servico: etapaParam,
        status: "sucesso",
        registros: r.gravados,
        mensagem: r.sem_empresa > 0 ? `${r.sem_empresa} registro(s) sem empresa mapeada.` : null,
      });
      return jsonResponse(r);
    } catch (err) {
      const mensagem = (err as Error).message;
      await supabase.from("financeiro_sync_log").insert({
        servico: etapaParam,
        status: "erro",
        mensagem,
        registros: 0,
      });
      return jsonResponse({ erro: mensagem }, 500);
    }
  }

  // ── Modo orquestrador (default): chama a si mesma uma vez por etapa ──────
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const selfUrl = `${baseUrl}/functions/v1/sync-senior-financeiro`;

  const resultados: Record<string, unknown> = {};
  for (const etapa of ETAPAS) {
    try {
      const res = await fetch(`${selfUrl}?stage=${etapa}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      });
      resultados[etapa] = await res.json().catch(() => ({ erro: `HTTP ${res.status} sem JSON` }));
    } catch (err) {
      resultados[etapa] = { erro: (err as Error).message };
    }
  }

  const algumSucesso = Object.values(resultados).some((r) => !(r as Record<string, unknown>).erro);
  return jsonResponse(resultados, algumSucesso ? 200 : 500);
});
