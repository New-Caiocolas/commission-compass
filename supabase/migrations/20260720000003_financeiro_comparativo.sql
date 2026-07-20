-- Comparativo lado a lado das 3 empresas: uma linha por empresa com os
-- principais indicadores, para a diretoria enxergar quem puxa o grupo pra cima
-- ou pra baixo sem trocar o filtro. Métricas de mês usam o último mês fechado
-- (mês calendário anterior).

CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_comparativo()
RETURNS TABLE(
  empresa_codigo TEXT,
  empresa_nome TEXT,
  a_pagar_aberto NUMERIC,
  a_receber_aberto NUMERIC,
  saldo_projetado NUMERIC,
  inadimplencia_pct NUMERIC,
  pmr_dias NUMERIC,
  pmp_dias NUMERIC,
  receita_mes NUMERIC,
  despesa_mes NUMERIC,
  resultado_mes NUMERIC,
  mes_ref TEXT
)
LANGUAGE sql STABLE
AS $$
  WITH ref AS (
    SELECT (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AS m
  ),
  pagar AS (
    SELECT empresa_id, SUM(valor) FILTER (WHERE status = 'AB') AS aberto
    FROM public.financeiro_contas_pagar GROUP BY empresa_id
  ),
  receber AS (
    SELECT empresa_id,
      SUM(valor) FILTER (WHERE status = 'AB') AS aberto,
      SUM(valor) FILTER (WHERE status = 'AB' AND data_vencimento < CURRENT_DATE) AS vencido
    FROM public.financeiro_contas_receber GROUP BY empresa_id
  ),
  pmr AS (
    SELECT empresa_id, AVG(data_pagamento - data_emissao) AS dias
    FROM public.financeiro_contas_receber
    WHERE data_pagamento IS NOT NULL AND data_emissao IS NOT NULL
      AND data_pagamento >= data_emissao
      AND data_pagamento >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY empresa_id
  ),
  pmp AS (
    SELECT empresa_id, AVG(data_pagamento - data_emissao) AS dias
    FROM public.financeiro_contas_pagar
    WHERE data_pagamento IS NOT NULL AND data_emissao IS NOT NULL
      AND data_pagamento >= data_emissao
      AND data_pagamento >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY empresa_id
  ),
  fat AS (
    SELECT f.empresa_id, SUM(f.valor_total) AS receita
    FROM public.financeiro_faturamento f, ref
    WHERE f.ano = EXTRACT(YEAR FROM ref.m)::int
      AND f.mes = EXTRACT(MONTH FROM ref.m)::int
    GROUP BY f.empresa_id
  ),
  desp AS (
    SELECT cp.empresa_id, SUM(cp.valor) AS despesa
    FROM public.financeiro_contas_pagar cp, ref
    WHERE cp.status = 'LQ'
      AND date_trunc('month', COALESCE(cp.data_pagamento, cp.data_vencimento))::date = ref.m
    GROUP BY cp.empresa_id
  )
  SELECT
    e.codigo,
    e.nome,
    COALESCE(pg.aberto, 0),
    COALESCE(rc.aberto, 0),
    COALESCE(rc.aberto, 0) - COALESCE(pg.aberto, 0),
    CASE WHEN COALESCE(rc.aberto, 0) = 0 THEN 0 ELSE COALESCE(rc.vencido, 0) / rc.aberto END,
    COALESCE(pmr.dias, 0),
    COALESCE(pmp.dias, 0),
    COALESCE(fat.receita, 0),
    COALESCE(desp.despesa, 0),
    COALESCE(fat.receita, 0) - COALESCE(desp.despesa, 0),
    to_char((SELECT m FROM ref), 'MM/YYYY')
  FROM public.financeiro_empresas e
  LEFT JOIN pagar pg ON pg.empresa_id = e.id
  LEFT JOIN receber rc ON rc.empresa_id = e.id
  LEFT JOIN pmr ON pmr.empresa_id = e.id
  LEFT JOIN pmp ON pmp.empresa_id = e.id
  LEFT JOIN fat ON fat.empresa_id = e.id
  LEFT JOIN desp ON desp.empresa_id = e.id
  WHERE e.ativo
  ORDER BY e.nome;
$$;
