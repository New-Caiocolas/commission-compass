-- Liquidez por HORIZONTE de vencimento.
--
-- Problema: somar todos os títulos em aberto inclui parcelas de financiamento que
-- vencem daqui a anos, então o "saldo projetado" ficava estruturalmente negativo
-- e não dizia nada sobre o caixa do mês. Agora os KPIs respeitam uma janela
-- (30/60/90 dias), contando também o que já venceu (vencidos são caixa de hoje).

DROP FUNCTION IF EXISTS public.get_kpi_financeiro_liquidez(TEXT);

CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_liquidez(
  empresa_codigo TEXT DEFAULT NULL,
  dias INT DEFAULT NULL   -- NULL = todo o saldo em aberto (sem recorte)
)
RETURNS TABLE(
  total_a_pagar_aberto NUMERIC,
  total_a_receber_aberto NUMERIC,
  saldo_projetado NUMERIC
)
LANGUAGE sql STABLE
AS $$
  WITH pagar AS (
    SELECT COALESCE(SUM(cp.valor), 0) AS v
    FROM public.financeiro_contas_pagar cp
    JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
    WHERE cp.status = 'AB'
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
      AND (dias IS NULL OR cp.data_vencimento <= CURRENT_DATE + dias)
  ),
  receber AS (
    SELECT COALESCE(SUM(cr.valor), 0) AS v
    FROM public.financeiro_contas_receber cr
    JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
    WHERE cr.status = 'AB'
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
      AND (dias IS NULL OR cr.data_vencimento <= CURRENT_DATE + dias)
  )
  SELECT pagar.v, receber.v, receber.v - pagar.v FROM pagar, receber;
$$;

-- Quanto do "a pagar" da janela é financiamento (parcela de empréstimo) vs
-- operacional — separa dívida de operação, que era a raiz da confusão.
CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_composicao_pagar(
  empresa_codigo TEXT DEFAULT NULL,
  dias INT DEFAULT NULL
)
RETURNS TABLE(
  mercadoria NUMERIC,
  financiamento NUMERIC,
  impostos NUMERIC,
  outras_despesas NUMERIC
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(SUM(cp.valor) FILTER (WHERE COALESCE(cp.senior_ctafin, 0) = 0), 0),
    COALESCE(SUM(cp.valor) FILTER (WHERE cp.senior_ctafin IN (140, 260)), 0),
    COALESCE(SUM(cp.valor) FILTER (WHERE m.grupo = 'imposto_venda' OR m.grupo = 'tributaria'), 0),
    COALESCE(SUM(cp.valor) FILTER (
      WHERE m.grupo IN ('pessoal', 'operacional')
         OR (m.grupo = 'financeira' AND cp.senior_ctafin NOT IN (140, 260))
    ), 0)
  FROM public.financeiro_contas_pagar cp
  JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
  LEFT JOIN public.financeiro_conta_dre m ON m.ctafin = cp.senior_ctafin
  WHERE cp.status = 'AB'
    AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    AND (dias IS NULL OR cp.data_vencimento <= CURRENT_DATE + dias);
$$;
