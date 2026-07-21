-- Fase 3: DRE Gerencial até o Lucro Bruto.
--   Receita Bruta − Impostos − Deduções = Receita Líquida − CMV = Lucro Bruto
-- Impostos/deduções vêm das notas (E140NFV); CMV vem do movimento de estoque
-- (E210MVP, saídas de venda). O Lucro Líquido NÃO é viável (contabilidade não
-- lançada no Senior), então a DRE para no Lucro Bruto.

-- Faturamento passa a guardar também impostos e deduções por empresa/mês.
ALTER TABLE public.financeiro_faturamento
  ADD COLUMN IF NOT EXISTS impostos NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deducoes NUMERIC DEFAULT 0;

-- CMV mensal por empresa (custo das saídas de venda).
CREATE TABLE IF NOT EXISTS public.financeiro_cmv (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.financeiro_empresas(id),
  ano INT NOT NULL,
  mes INT NOT NULL,
  valor NUMERIC DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (empresa_id, ano, mes)
);

ALTER TABLE public.financeiro_cmv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read" ON public.financeiro_cmv;
CREATE POLICY "Admin read" ON public.financeiro_cmv FOR SELECT USING (public.is_admin());

-- DRE Gerencial mensal (cascata até o Lucro Bruto).
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
  margem_bruta NUMERIC
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
  custo AS (
    SELECT c.ano, c.mes, SUM(c.valor) AS cmv
    FROM public.financeiro_cmv c
    JOIN public.financeiro_empresas e ON e.id = c.empresa_id
    WHERE (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY c.ano, c.mes
  ),
  juntos AS (
    SELECT
      COALESCE(f.ano, c.ano) AS ano,
      COALESCE(f.mes, c.mes) AS mes,
      COALESCE(f.receita_bruta, 0) AS receita_bruta,
      COALESCE(f.impostos, 0) AS impostos,
      COALESCE(f.deducoes, 0) AS deducoes,
      COALESCE(c.cmv, 0) AS cmv
    FROM fat f
    FULL JOIN custo c ON c.ano = f.ano AND c.mes = f.mes
  )
  SELECT
    ano, mes, receita_bruta, impostos, deducoes,
    receita_bruta - impostos - deducoes AS receita_liquida,
    cmv,
    (receita_bruta - impostos - deducoes) - cmv AS lucro_bruto,
    CASE WHEN (receita_bruta - impostos - deducoes) > 0
      THEN ((receita_bruta - impostos - deducoes) - cmv) / (receita_bruta - impostos - deducoes)
      ELSE 0 END AS margem_bruta
  FROM juntos
  WHERE make_date(ano, mes, 1) >= date_trunc('month', CURRENT_DATE) - (meses || ' months')::interval
    AND make_date(ano, mes, 1) <= date_trunc('month', CURRENT_DATE)
  ORDER BY ano, mes;
$$;
