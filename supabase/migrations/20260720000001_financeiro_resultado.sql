-- Fase 2 do financeiro: faturamento mensal (receita) e KPI de resultado gerencial
-- (receita faturada − despesas pagas), alimentados pelas novas portas do
-- com.ello.metrics: ConsultarFaturamento (agregado por mês) e ConsultarContasReceber.

-- Receita: faturamento agregado por empresa/mês (a porta já agrega no Senior,
-- então o volume é minúsculo — ~24 linhas por empresa).
CREATE TABLE public.financeiro_faturamento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.financeiro_empresas(id),
  ano INT NOT NULL,
  mes INT NOT NULL,
  valor_total NUMERIC DEFAULT 0,
  qtd_notas INT DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (empresa_id, ano, mes)
);

ALTER TABLE public.financeiro_faturamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.financeiro_faturamento FOR SELECT USING (true);

-- Resultado gerencial mensal: receita (faturamento) vs despesa (títulos LQ,
-- usando o vencimento como proxy da data de pagamento — o serviço ainda não
-- traz a data de baixa). NÃO é lucro contábil (sem CMV/impostos/depreciação).
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
      EXTRACT(YEAR FROM cp.data_vencimento)::int AS ano,
      EXTRACT(MONTH FROM cp.data_vencimento)::int AS mes,
      SUM(cp.valor) AS despesa
    FROM public.financeiro_contas_pagar cp
    JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
    WHERE cp.status = 'LQ' AND cp.data_vencimento IS NOT NULL
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

-- Fluxo de caixa projetado: em aberto (AB) por semana de vencimento,
-- entradas (receber) vs saídas (pagar), próximas N semanas.
CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_fluxo_semanal(
  empresa_codigo TEXT DEFAULT NULL,
  semanas INT DEFAULT 8
)
RETURNS TABLE(semana DATE, entradas NUMERIC, saidas NUMERIC, saldo NUMERIC)
LANGUAGE sql STABLE
AS $$
  WITH pagar AS (
    SELECT date_trunc('week', cp.data_vencimento)::date AS semana, SUM(cp.valor) AS saidas
    FROM public.financeiro_contas_pagar cp
    JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
    WHERE cp.status = 'AB' AND cp.data_vencimento IS NOT NULL
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY 1
  ),
  receber AS (
    SELECT date_trunc('week', cr.data_vencimento)::date AS semana, SUM(cr.valor) AS entradas
    FROM public.financeiro_contas_receber cr
    JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
    WHERE cr.status = 'AB' AND cr.data_vencimento IS NOT NULL
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY 1
  ),
  juntos AS (
    SELECT
      COALESCE(p.semana, r.semana) AS semana,
      COALESCE(r.entradas, 0) AS entradas,
      COALESCE(p.saidas, 0) AS saidas
    FROM pagar p
    FULL JOIN receber r ON r.semana = p.semana
  )
  SELECT semana, entradas, saidas, entradas - saidas AS saldo
  FROM juntos
  WHERE semana >= date_trunc('week', CURRENT_DATE)::date
    AND semana < date_trunc('week', CURRENT_DATE)::date + (semanas * 7)
  ORDER BY semana;
$$;
