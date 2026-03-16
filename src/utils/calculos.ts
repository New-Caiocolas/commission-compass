// Registro individual da tabela comissoes (usado em Notas.tsx)
export interface ApuracaoRecord {
  id: number;
  num_nf: string;
  repres_vend: number;
  nome_rep: string;
  nome_cliente: string;
  dt_pag: string;
  prc_nf: number;
  vlr_desc: number;
  vlr_acresc: number;
  vlr_negativa: number;
  vlr_ajustada: number;
  vlr_base_comis: number;
  vlr_exced: number;
  vlr_frete: number;
  frete_na_nf: number;
  desconto_1: number;
  criado_em: string;
}

// Registro já agregado vindo da RPC get_apuracao
export interface ApuracaoAgregada {
  nome_rep: string;
  vlr_nf: number;
  vlr_comissao_ajustada: number;
  vlr_negativo: number;
  vlr_excedente_nf: number;
  vlr_frete_cte: number;
  vlr_frete_desp: number;
  desconto_1: number;
}

export interface CalculosResult {
  vlrNF: number;
  vlrComissaoAjustada: number;
  vlrNegativo: number;
  vlrComissaoNF: number;
  percComissaoNF: number;
  vlrExcedenteNF: number;
  vlrFreteCTE: number;
  vlrFreteDespAcessoria: number;
  vlrDespTotalFrete: number;
  vlrExcedenteFlex: number;
  percExcedenteFlex: number;
  percAproveitamentoFlex: number;
  vlrAproveitamentoFlex: number;
  vlrSaldoFlex: number;
  percComissaoFinal: number;
  vlrComissaoFinal: number;
  somaDesconto1: number;
}

export function calcularMedidas(rows: ApuracaoAgregada[]): CalculosResult {
  const vlrNF = rows.reduce((s, r) => s + (Number(r.vlr_nf) || 0), 0);
  const vlrComissaoAjustada = rows.reduce((s, r) => s + (Number(r.vlr_comissao_ajustada) || 0), 0);
  const vlrNegativo = rows.reduce((s, r) => s + (Number(r.vlr_negativo) || 0), 0);
  const vlrComissaoNF = vlrComissaoAjustada - vlrNegativo;
  const percComissaoNF = vlrNF !== 0 ? vlrComissaoNF / vlrNF : 0;
  const vlrExcedenteNF = rows.reduce((s, r) => s + (Number(r.vlr_excedente_nf) || 0), 0);
  const vlrFreteCTE = rows.reduce((s, r) => s + (Number(r.vlr_frete_cte) || 0), 0);
  const vlrFreteDespAcessoria = rows.reduce((s, r) => s + (Number(r.vlr_frete_desp) || 0), 0);
  const vlrDespTotalFrete = Math.max(0, vlrFreteCTE - vlrFreteDespAcessoria);
  const vlrExcedenteFlex = vlrExcedenteNF - vlrDespTotalFrete;
  const percExcedenteFlex = vlrNF !== 0 ? vlrExcedenteFlex / vlrNF : 0;

  const diff = 0.05 - percComissaoNF;
  const percAproveitamentoFlex = diff <= percExcedenteFlex ? diff : percExcedenteFlex;

  const vlrAproveitamentoFlex = percAproveitamentoFlex * vlrNF;
  const vlrSaldoFlex = vlrExcedenteFlex - vlrAproveitamentoFlex;
  const percComissaoFinal = percComissaoNF + percAproveitamentoFlex;
  const vlrComissaoFinal = percComissaoFinal * vlrNF;
  const somaDesconto1 = rows.reduce((s, r) => s + (Number(r.desconto_1) || 0), 0);

  return {
    vlrNF, vlrComissaoAjustada, vlrNegativo, vlrComissaoNF, percComissaoNF,
    vlrExcedenteNF, vlrFreteCTE, vlrFreteDespAcessoria, vlrDespTotalFrete,
    vlrExcedenteFlex, percExcedenteFlex, percAproveitamentoFlex,
    vlrAproveitamentoFlex, vlrSaldoFlex, percComissaoFinal, vlrComissaoFinal,
    somaDesconto1,
  };
}

export interface VendedorResumo {
  nomeRep: string;
  calculos: CalculosResult;
}

const EXCLUIR_REPRESENTANTES = ['FUNCIONARIO', 'Padrão Empresa'];

export function agruparPorVendedor(rows: ApuracaoAgregada[]): VendedorResumo[] {
  return rows
    .filter(r => r.nome_rep && !EXCLUIR_REPRESENTANTES.includes(r.nome_rep))
    .map(r => ({
      nomeRep: r.nome_rep,
      calculos: calcularMedidas([r]), // cada vendedor já vem agregado
    }));
}
