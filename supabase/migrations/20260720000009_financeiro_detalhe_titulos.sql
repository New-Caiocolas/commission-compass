-- Drill-down: lista os títulos que compõem um número do dashboard.
-- Um único ponto de entrada, filtrado pelos mesmos critérios usados nos KPIs
-- (tipo, empresa, situação, vencidos, faixa de aging, parceiro), para o detalhe
-- sempre bater com o total exibido.

CREATE OR REPLACE FUNCTION public.get_financeiro_titulos(
  p_tipo TEXT,                          -- 'pagar' | 'receber'
  p_empresa TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,           -- 'AB' | 'LQ'
  p_vencidos BOOLEAN DEFAULT FALSE,     -- só os já vencidos (em aberto)
  p_faixa TEXT DEFAULT NULL,            -- faixa de aging (mesmos rótulos do gráfico)
  p_parceiro TEXT DEFAULT NULL,         -- cliente/fornecedor exato
  p_limite INT DEFAULT 200
)
RETURNS TABLE(
  empresa TEXT,
  titulo TEXT,
  parceiro TEXT,
  valor NUMERIC,
  data_emissao DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT,
  dias_atraso INT
)
LANGUAGE sql STABLE
AS $$
  WITH base AS (
    SELECT e.nome AS empresa, cp.senior_titulo AS titulo, cp.fornecedor AS parceiro,
           cp.valor, cp.data_emissao, cp.data_vencimento, cp.data_pagamento, cp.status
    FROM public.financeiro_contas_pagar cp
    JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
    WHERE p_tipo = 'pagar' AND (p_empresa IS NULL OR e.codigo = p_empresa)
    UNION ALL
    SELECT e.nome, cr.senior_titulo, cr.cliente,
           cr.valor, cr.data_emissao, cr.data_vencimento, cr.data_pagamento, cr.status
    FROM public.financeiro_contas_receber cr
    JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
    WHERE p_tipo = 'receber' AND (p_empresa IS NULL OR e.codigo = p_empresa)
  ),
  filtrado AS (
    SELECT *,
      (CURRENT_DATE - data_vencimento)::int AS atraso
    FROM base
    WHERE (p_status IS NULL OR status = p_status)
      AND (NOT p_vencidos OR (data_vencimento < CURRENT_DATE AND status = 'AB'))
      AND (p_parceiro IS NULL OR parceiro = p_parceiro)
  )
  SELECT empresa, titulo, parceiro, valor, data_emissao, data_vencimento, data_pagamento, status,
         GREATEST(atraso, 0) AS dias_atraso
  FROM filtrado
  WHERE p_faixa IS NULL OR p_faixa = (
    CASE
      WHEN data_vencimento >= CURRENT_DATE THEN 'A vencer'
      WHEN atraso <= 30 THEN '0-30 dias'
      WHEN atraso <= 60 THEN '31-60 dias'
      WHEN atraso <= 90 THEN '61-90 dias'
      ELSE '90+ dias'
    END
  )
  ORDER BY valor DESC
  LIMIT p_limite;
$$;
