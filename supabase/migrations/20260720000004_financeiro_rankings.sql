-- Rankings acionáveis: Top devedores (recebíveis vencidos por cliente) e Top
-- fornecedores (a pagar em aberto por fornecedor). Dependem do nome do parceiro
-- vindo na sincronização (cliente/fornecedor) — enquanto vier nulo, agrupam em
-- "(sem nome)".

CREATE OR REPLACE FUNCTION public.get_kpi_top_devedores(
  empresa_codigo TEXT DEFAULT NULL,
  limite INT DEFAULT 10
)
RETURNS TABLE(cliente TEXT, valor NUMERIC, quantidade BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(cr.cliente), ''), '(sem nome)') AS cliente,
    SUM(cr.valor) AS valor,
    COUNT(*)::bigint AS quantidade
  FROM public.financeiro_contas_receber cr
  JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
  WHERE cr.status = 'AB' AND cr.data_vencimento < CURRENT_DATE
    AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
  GROUP BY COALESCE(NULLIF(TRIM(cr.cliente), ''), '(sem nome)')
  ORDER BY SUM(cr.valor) DESC
  LIMIT limite;
$$;

CREATE OR REPLACE FUNCTION public.get_kpi_top_fornecedores(
  empresa_codigo TEXT DEFAULT NULL,
  limite INT DEFAULT 10
)
RETURNS TABLE(fornecedor TEXT, valor NUMERIC, quantidade BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(cp.fornecedor), ''), '(sem nome)') AS fornecedor,
    SUM(cp.valor) AS valor,
    COUNT(*)::bigint AS quantidade
  FROM public.financeiro_contas_pagar cp
  JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
  WHERE cp.status = 'AB'
    AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
  GROUP BY COALESCE(NULLIF(TRIM(cp.fornecedor), ''), '(sem nome)')
  ORDER BY SUM(cp.valor) DESC
  LIMIT limite;
$$;
