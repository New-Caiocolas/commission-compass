-- CORREÇÃO CRÍTICA da DRE (validada contra apuração da controladoria).
--
-- Problema encontrado: os impostos usados vinham do que está DESTACADO NA NOTA
-- (VlrIcm+VlrPis+VlrCff). Num atacadão com ICMS-ST/antecipação, o imposto
-- efetivamente PAGO é ~2x maior que o destacado. No 2º tri/2026 da Ello:
--   destacado na nota .... R$ 484.956
--   pago (títulos) ....... R$ 997.906   -> R$ 512.950 sumiam da DRE
-- Isso transformava prejuízo real em lucro aparente.
--
-- Correção: os impostos passam a vir dos TÍTULOS efetivamente pagos/devidos
-- (classificação ctafin), e não mais da nota. O campo de imposto da nota fica
-- guardado só como referência.
--
-- Também introduz `percentual`: contas cujo título mistura despesa e não-despesa
-- (parcela de financiamento = juros + principal) entram na DRE apenas na fração
-- informada pela controladoria.

ALTER TABLE public.financeiro_conta_dre
  ADD COLUMN IF NOT EXISTS percentual NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Novo grupo: imposto sobre vendas (deduz da receita bruta, antes da líquida).
ALTER TABLE public.financeiro_conta_dre DROP CONSTRAINT IF EXISTS financeiro_conta_dre_grupo_check;
ALTER TABLE public.financeiro_conta_dre ADD CONSTRAINT financeiro_conta_dre_grupo_check
  CHECK (grupo IN ('imposto_venda', 'pessoal', 'operacional', 'financeira', 'tributaria', 'excluir'));

-- Impostos sobre venda: saem de 'excluir' e passam a deduzir a receita.
UPDATE public.financeiro_conta_dre SET grupo = 'imposto_venda'
WHERE ctafin IN (570, 530, 500, 1090, 760, 770, 750);

-- Parcelas de financiamento: contêm juros (despesa) + principal (amortização).
-- percentual = fração que é juros. AJUSTE COM A CONTROLADORIA — o default 1
-- (100% como despesa) é conservador e reflete o desembolso cheio.
UPDATE public.financeiro_conta_dre
SET grupo = 'financeira', percentual = 1,
    observacao = 'Parcela de financiamento (juros + principal). Ajustar percentual para a fração de juros informada pela controladoria.'
WHERE ctafin IN (140, 260);

DROP FUNCTION IF EXISTS public.get_kpi_financeiro_dre(TEXT, INT);

CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_dre(
  empresa_codigo TEXT DEFAULT NULL,
  meses INT DEFAULT 12
)
RETURNS TABLE(
  ano INT, mes INT,
  receita_bruta NUMERIC, impostos NUMERIC, deducoes NUMERIC, receita_liquida NUMERIC,
  cmv NUMERIC, lucro_bruto NUMERIC,
  desp_pessoal NUMERIC, desp_operacional NUMERIC, desp_financeira NUMERIC, desp_tributaria NUMERIC,
  despesas NUMERIC, resultado_liquido NUMERIC,
  margem_bruta NUMERIC, margem_liquida NUMERIC
)
LANGUAGE sql STABLE
AS $$
  WITH fat AS (
    SELECT f.ano, f.mes, SUM(f.valor_total) AS receita_bruta, SUM(f.deducoes) AS deducoes
    FROM public.financeiro_faturamento f
    JOIN public.financeiro_empresas e ON e.id = f.empresa_id
    WHERE (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY f.ano, f.mes
  ),
  pag AS (
    SELECT
      EXTRACT(YEAR FROM cp.data_emissao)::int AS ano,
      EXTRACT(MONTH FROM cp.data_emissao)::int AS mes,
      -- compra de mercadoria: título sem classificação financeira
      SUM(cp.valor) FILTER (WHERE COALESCE(cp.senior_ctafin, 0) = 0) AS cmv,
      -- imposto sobre venda: o efetivamente pago (inclui ST/antecipação)
      SUM(cp.valor * m.percentual) FILTER (WHERE m.grupo = 'imposto_venda') AS impostos,
      SUM(cp.valor * m.percentual) FILTER (WHERE m.grupo = 'pessoal') AS desp_pessoal,
      SUM(cp.valor * m.percentual) FILTER (WHERE m.grupo = 'operacional') AS desp_operacional,
      SUM(cp.valor * m.percentual) FILTER (WHERE m.grupo = 'financeira') AS desp_financeira,
      SUM(cp.valor * m.percentual) FILTER (WHERE m.grupo = 'tributaria') AS desp_tributaria
    FROM public.financeiro_contas_pagar cp
    JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
    LEFT JOIN public.financeiro_conta_dre m ON m.ctafin = cp.senior_ctafin
    WHERE cp.data_emissao IS NOT NULL
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY 1, 2
  ),
  j AS (
    SELECT
      COALESCE(f.ano, p.ano) AS ano, COALESCE(f.mes, p.mes) AS mes,
      COALESCE(f.receita_bruta, 0) AS receita_bruta,
      COALESCE(f.deducoes, 0) AS deducoes,
      COALESCE(p.impostos, 0) AS impostos,
      COALESCE(p.cmv, 0) AS cmv,
      COALESCE(p.desp_pessoal, 0) AS desp_pessoal,
      COALESCE(p.desp_operacional, 0) AS desp_operacional,
      COALESCE(p.desp_financeira, 0) AS desp_financeira,
      COALESCE(p.desp_tributaria, 0) AS desp_tributaria
    FROM fat f FULL JOIN pag p ON p.ano = f.ano AND p.mes = f.mes
  ),
  c AS (
    SELECT *,
      receita_bruta - impostos - deducoes AS receita_liquida,
      desp_pessoal + desp_operacional + desp_financeira + desp_tributaria AS despesas
    FROM j
  )
  SELECT
    ano, mes, receita_bruta, impostos, deducoes, receita_liquida, cmv,
    receita_liquida - cmv AS lucro_bruto,
    desp_pessoal, desp_operacional, desp_financeira, desp_tributaria, despesas,
    receita_liquida - cmv - despesas AS resultado_liquido,
    CASE WHEN receita_liquida > 0 THEN (receita_liquida - cmv) / receita_liquida ELSE 0 END AS margem_bruta,
    CASE WHEN receita_liquida > 0 THEN (receita_liquida - cmv - despesas) / receita_liquida ELSE 0 END AS margem_liquida
  FROM c
  WHERE make_date(ano, mes, 1) >= date_trunc('month', CURRENT_DATE) - (meses || ' months')::interval
    AND make_date(ano, mes, 1) <= date_trunc('month', CURRENT_DATE)
  ORDER BY ano, mes;
$$;
