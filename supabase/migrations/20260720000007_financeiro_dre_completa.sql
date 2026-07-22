-- DRE Gerencial completa até o Resultado Líquido, usando a classificação
-- financeira (E091PLF/ctafin) dos títulos de contas a pagar:
--   ctafin = 0/null  -> compra de mercadoria (CMV real, com ST)
--   ctafin > 0       -> despesa classificada (pessoal, operacional, financeira, tributária)
--
-- Base: regime de competência (data de emissão). Por empresa inclui o intercompany
-- (custo real standalone); no consolidado o intercompany não é eliminado ainda
-- (melhoria futura). CMV pelo estoque foi abandonado por subestimar commodities.

ALTER TABLE public.financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS senior_ctafin INT DEFAULT 0;

-- A função já existe (versão até lucro bruto) com outro tipo de retorno;
-- CREATE OR REPLACE não muda o retorno, então dropa antes.
DROP FUNCTION IF EXISTS public.get_kpi_financeiro_dre(TEXT, INT);

CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_dre(
  empresa_codigo TEXT DEFAULT NULL,
  meses INT DEFAULT 12
)
RETURNS TABLE(
  ano INT, mes INT,
  receita_bruta NUMERIC,
  impostos NUMERIC,
  deducoes NUMERIC,
  receita_liquida NUMERIC,
  cmv NUMERIC,
  lucro_bruto NUMERIC,
  despesas NUMERIC,
  resultado_liquido NUMERIC,
  margem_bruta NUMERIC,
  margem_liquida NUMERIC
)
LANGUAGE sql STABLE
AS $$
  WITH fat AS (
    SELECT f.ano, f.mes,
      SUM(f.valor_total) AS receita_bruta,
      SUM(f.impostos) AS impostos,
      SUM(f.deducoes) AS deducoes
    FROM public.financeiro_faturamento f
    JOIN public.financeiro_empresas e ON e.id = f.empresa_id
    WHERE (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY f.ano, f.mes
  ),
  pagar AS (
    SELECT
      EXTRACT(YEAR FROM cp.data_emissao)::int AS ano,
      EXTRACT(MONTH FROM cp.data_emissao)::int AS mes,
      SUM(cp.valor) FILTER (WHERE COALESCE(cp.senior_ctafin, 0) = 0) AS cmv,
      SUM(cp.valor) FILTER (WHERE COALESCE(cp.senior_ctafin, 0) > 0) AS despesas
    FROM public.financeiro_contas_pagar cp
    JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
    WHERE cp.data_emissao IS NOT NULL
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY 1, 2
  ),
  juntos AS (
    SELECT
      COALESCE(f.ano, p.ano) AS ano,
      COALESCE(f.mes, p.mes) AS mes,
      COALESCE(f.receita_bruta, 0) AS receita_bruta,
      COALESCE(f.impostos, 0) AS impostos,
      COALESCE(f.deducoes, 0) AS deducoes,
      COALESCE(p.cmv, 0) AS cmv,
      COALESCE(p.despesas, 0) AS despesas
    FROM fat f
    FULL JOIN pagar p ON p.ano = f.ano AND p.mes = f.mes
  ),
  calc AS (
    SELECT *,
      receita_bruta - impostos - deducoes AS receita_liquida
    FROM juntos
  )
  SELECT
    ano, mes, receita_bruta, impostos, deducoes, receita_liquida, cmv,
    receita_liquida - cmv AS lucro_bruto,
    despesas,
    receita_liquida - cmv - despesas AS resultado_liquido,
    CASE WHEN receita_liquida > 0 THEN (receita_liquida - cmv) / receita_liquida ELSE 0 END AS margem_bruta,
    CASE WHEN receita_liquida > 0 THEN (receita_liquida - cmv - despesas) / receita_liquida ELSE 0 END AS margem_liquida
  FROM calc
  WHERE make_date(ano, mes, 1) >= date_trunc('month', CURRENT_DATE) - (meses || ' months')::interval
    AND make_date(ano, mes, 1) <= date_trunc('month', CURRENT_DATE)
  ORDER BY ano, mes;
$$;
