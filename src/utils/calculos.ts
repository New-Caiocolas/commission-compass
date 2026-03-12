export interface ApuracaoRecord {
  id: string;
  num_nf: string;
  repres_vend: string;
  nome_rep: string;
  nome_cliente: string;
  dt_pag: string;
  prc_nf: number;
  vlr_desc: number;
  vlr_acresc: number;
  vlr_negativa: number;
  vlr_ajustada: number;
  vlr_comissao_nf: number;
  vlr_exced: number;
  vlr_frete_cte: number;
  vlr_frete_desp_acessoria: number;
  desconto_1: number;
  created_at: string;
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

export function calcularMedidas(records: ApuracaoRecord[]): CalculosResult {
  const vlrNF = records.reduce((s, r) => s + (r.prc_nf || 0), 0);
  const vlrComissaoAjustada = records.reduce((s, r) => s + (r.vlr_ajustada || 0), 0);
  const vlrNegativo = records.reduce((s, r) => s + (r.vlr_negativa || 0), 0);
  const vlrComissaoNF = vlrComissaoAjustada - vlrNegativo;
  const percComissaoNF = vlrNF !== 0 ? vlrComissaoNF / vlrNF : 0;
  const vlrExcedenteNF = records.reduce((s, r) => s + (r.vlr_exced || 0), 0);
  const vlrFreteCTE = records.reduce((s, r) => s + (r.vlr_frete_cte || 0), 0);
  const vlrFreteDespAcessoria = records.reduce((s, r) => s + (r.vlr_frete_desp_acessoria || 0), 0);
  const vlrDespTotalFrete = Math.max(0, vlrFreteCTE - vlrFreteDespAcessoria);
  const vlrExcedenteFlex = vlrExcedenteNF - vlrDespTotalFrete;
  const percExcedenteFlex = vlrNF !== 0 ? vlrExcedenteFlex / vlrNF : 0;

  const diff = 0.05 - percComissaoNF;
  const percAproveitamentoFlex = diff <= percExcedenteFlex ? diff : percExcedenteFlex;

  const vlrAproveitamentoFlex = percAproveitamentoFlex * vlrNF;
  const vlrSaldoFlex = vlrExcedenteFlex - vlrAproveitamentoFlex;
  const percComissaoFinal = percComissaoNF + percAproveitamentoFlex;
  const vlrComissaoFinal = percComissaoFinal * vlrNF;
  const somaDesconto1 = records.reduce((s, r) => s + (r.desconto_1 || 0), 0);

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
  registros: ApuracaoRecord[];
  calculos: CalculosResult;
}

export function agruparPorVendedor(records: ApuracaoRecord[]): VendedorResumo[] {
  const map = new Map<string, ApuracaoRecord[]>();
  for (const r of records) {
    const key = r.nome_rep || 'Sem Representante';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([nomeRep, registros]) => ({
    nomeRep,
    registros,
    calculos: calcularMedidas(registros),
  }));
}
