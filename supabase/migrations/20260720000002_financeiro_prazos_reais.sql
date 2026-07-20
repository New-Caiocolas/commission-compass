-- PMR/PMP reais a partir da data de baixa (UltPgt) que passa a vir na sincronização
-- em data_pagamento. Duas melhorias:
--   1) get_kpi_financeiro_prazos: média dos títulos pagos nos últimos 12 meses
--      (reflete o comportamento atual, não a história inteira) e ignora casos
--      inconsistentes (pagamento antes da emissão).
--   2) get_kpi_financeiro_resultado: a despesa do mês passa a usar a data de
--      pagamento real (data_pagamento) quando existir, com fallback no vencimento.

CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_prazos(empresa_codigo TEXT DEFAULT NULL)
RETURNS TABLE(
  pmr_dias NUMERIC,
  pmp_dias NUMERIC
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE((
      SELECT AVG(cr.data_pagamento - cr.data_emissao)
      FROM public.financeiro_contas_receber cr
      JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
      WHERE cr.data_pagamento IS NOT NULL AND cr.data_emissao IS NOT NULL
        AND cr.data_pagamento >= cr.data_emissao
        AND cr.data_pagamento >= CURRENT_DATE - INTERVAL '12 months'
        AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    ), 0) AS pmr_dias,
    COALESCE((
      SELECT AVG(cp.data_pagamento - cp.data_emissao)
      FROM public.financeiro_contas_pagar cp
      JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
      WHERE cp.data_pagamento IS NOT NULL AND cp.data_emissao IS NOT NULL
        AND cp.data_pagamento >= cp.data_emissao
        AND cp.data_pagamento >= CURRENT_DATE - INTERVAL '12 months'
        AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    ), 0) AS pmp_dias;
$$;

-- Resultado gerencial: despesa por mês pela data de PAGAMENTO real (data_pagamento),
-- caindo no vencimento apenas quando a baixa ainda não veio.
CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_resultado(
  empresa_codigo TEXT DEFAULT NULL,
  meses INT DEFAULT 12
)
RETURNS TABLE(ano INT, mes INT, receita NUMERIC, despesa NUMERIC, resultado NUMERIC)
LANGUAGE sql STABLE
AS $$
  WITH rec AS (
    SELECT f.ano, f.mes, SUM(f.valor_total) AS receita
    FROM public.financeiro_faturamento f
    JOIN public.financeiro_empresas e ON e.id = f.empresa_id
    WHERE (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY f.ano, f.mes
  ),
  desp AS (
    SELECT
      EXTRACT(YEAR FROM COALESCE(cp.data_pagamento, cp.data_vencimento))::int AS ano,
      EXTRACT(MONTH FROM COALESCE(cp.data_pagamento, cp.data_vencimento))::int AS mes,
      SUM(cp.valor) AS despesa
    FROM public.financeiro_contas_pagar cp
    JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
    WHERE cp.status = 'LQ' AND COALESCE(cp.data_pagamento, cp.data_vencimento) IS NOT NULL
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY 1, 2
  ),
  juntos AS (
    SELECT
      COALESCE(r.ano, d.ano) AS ano,
      COALESCE(r.mes, d.mes) AS mes,
      COALESCE(r.receita, 0) AS receita,
      COALESCE(d.despesa, 0) AS despesa
    FROM rec r
    FULL JOIN desp d ON d.ano = r.ano AND d.mes = r.mes
  )
  SELECT ano, mes, receita, despesa, receita - despesa AS resultado
  FROM juntos
  WHERE make_date(ano, mes, 1) >= date_trunc('month', CURRENT_DATE) - (meses || ' months')::interval
    AND make_date(ano, mes, 1) <= date_trunc('month', CURRENT_DATE)
  ORDER BY ano, mes;
$$;
