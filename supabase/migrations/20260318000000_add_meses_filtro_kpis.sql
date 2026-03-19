-- Recria get_kpis_vendedor com filtro opcional de meses
CREATE OR REPLACE FUNCTION public.get_kpis_vendedor(
  anos_filtro int[],
  meses_filtro int[] DEFAULT NULL
)
RETURNS TABLE(
  nome_rep text,
  repres_vend int,
  qtd_nfs bigint,
  qtd_clientes bigint,
  vlr_nf numeric,
  vlr_comissao_ajustada numeric,
  vlr_negativo numeric,
  vlr_excedente_nf numeric,
  vlr_frete_cte numeric,
  vlr_frete_desp numeric,
  desconto_1 numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.nome_rep,
    c.repres_vend,
    COUNT(*)::bigint            AS qtd_nfs,
    COUNT(DISTINCT c.nome_cliente)::bigint AS qtd_clientes,
    COALESCE(SUM(c.prc_nf), 0)          AS vlr_nf,
    COALESCE(SUM(c.vlr_ajustada), 0)    AS vlr_comissao_ajustada,
    COALESCE(SUM(c.vlr_negativa), 0)    AS vlr_negativo,
    COALESCE(SUM(c.vlr_exced), 0)       AS vlr_excedente_nf,
    COALESCE(SUM(c.vlr_frete), 0)       AS vlr_frete_cte,
    COALESCE(SUM(c.frete_na_nf), 0)     AS vlr_frete_desp,
    COALESCE(SUM(c.desconto_1), 0)      AS desconto_1
  FROM comissoes c
  WHERE EXTRACT(YEAR FROM c.dt_pag)::int = ANY(anos_filtro)
    AND (meses_filtro IS NULL OR EXTRACT(MONTH FROM c.dt_pag)::int = ANY(meses_filtro))
  GROUP BY c.nome_rep, c.repres_vend;
$$;

-- Recria get_evolucao_mensal com filtro opcional de meses
CREATE OR REPLACE FUNCTION public.get_evolucao_mensal(
  anos_filtro int[],
  meses_filtro int[] DEFAULT NULL
)
RETURNS TABLE(
  ano int,
  mes int,
  vlr_nf numeric,
  vlr_comissao numeric,
  vlr_frete numeric,
  vlr_negativo numeric,
  qtd_nfs bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    EXTRACT(YEAR FROM c.dt_pag)::int   AS ano,
    EXTRACT(MONTH FROM c.dt_pag)::int  AS mes,
    COALESCE(SUM(c.prc_nf), 0)         AS vlr_nf,
    COALESCE(SUM(c.vlr_ajustada), 0)   AS vlr_comissao,
    COALESCE(SUM(c.vlr_frete), 0)      AS vlr_frete,
    COALESCE(SUM(c.vlr_negativa), 0)   AS vlr_negativo,
    COUNT(*)::bigint                    AS qtd_nfs
  FROM comissoes c
  WHERE EXTRACT(YEAR FROM c.dt_pag)::int = ANY(anos_filtro)
    AND (meses_filtro IS NULL OR EXTRACT(MONTH FROM c.dt_pag)::int = ANY(meses_filtro))
  GROUP BY ano, mes
  ORDER BY ano, mes;
$$;
