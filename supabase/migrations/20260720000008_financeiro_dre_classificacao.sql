-- Classificação das contas financeiras (ctafin) no papel correto da DRE.
-- O plano financeiro do Senior é uma classificação de FLUXO DE CAIXA — mistura
-- despesa real com pagamento de dívida, adiantamentos e distribuição de lucros.
-- Esta tabela mapeia cada ctafin para o grupo de DRE, para a despesa somar só o
-- que é despesa DE VERDADE. A controladoria pode ajustar as linhas aqui.
--
-- grupos: 'pessoal' | 'operacional' | 'financeira' | 'tributaria' (= despesas da DRE)
--         'excluir' (não é DRE: dívida, adiantamento, distribuição, imposto s/ venda)

CREATE TABLE IF NOT EXISTS public.financeiro_conta_dre (
  ctafin INT PRIMARY KEY,
  descricao TEXT,
  grupo TEXT NOT NULL CHECK (grupo IN ('pessoal', 'operacional', 'financeira', 'tributaria', 'excluir'))
);

ALTER TABLE public.financeiro_conta_dre ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read" ON public.financeiro_conta_dre;
CREATE POLICY "Admin read" ON public.financeiro_conta_dre FOR SELECT USING (public.is_admin());

INSERT INTO public.financeiro_conta_dre (ctafin, descricao, grupo) VALUES
  (190, 'Salario', 'pessoal'),
  (480, 'INSS', 'pessoal'),
  (490, 'FGTS', 'pessoal'),
  (200, 'Ferias', 'pessoal'),
  (870, '13o Salario', 'pessoal'),
  (220, 'Rescisao', 'pessoal'),
  (590, 'Assistencia Medica Diretoria', 'pessoal'),
  (320, 'Assistencia Medica Funcionario', 'pessoal'),
  (600, 'Plano Odontologico', 'pessoal'),
  (1080, 'Multa FGTS', 'pessoal'),
  (800, 'IPTU', 'operacional'),
  (810, 'IPVA', 'operacional'),
  (820, 'TFF', 'operacional'),
  (790, 'Impostos Diversos', 'operacional'),
  (690, 'Refeicao', 'operacional'),
  (730, 'Transporte', 'operacional'),
  (350, 'Telefone e Internet', 'operacional'),
  (410, 'Frete de Entrada', 'operacional'),
  (450, 'Veiculos', 'operacional'),
  (380, 'Manutencao Maq. e Equipamentos', 'operacional'),
  (340, 'Energia', 'operacional'),
  (460, 'Manutencao de Sistemas', 'operacional'),
  (1030, 'Manutencao Site', 'operacional'),
  (310, 'Material de Escritorio', 'operacional'),
  (330, 'Agua', 'operacional'),
  (1020, 'Viagem e Hospedagem', 'operacional'),
  (780, 'Pedagio', 'operacional'),
  (700, 'Combustivel', 'operacional'),
  (990, 'Servico Prestado PJ', 'operacional'),
  (510, 'Despesas Diversas', 'operacional'),
  (270, 'Tarifas Bancarias', 'financeira'),
  (280, 'Outras Despesas Bancarias', 'financeira'),
  (930, 'IRPJ', 'tributaria'),
  (540, 'CSLL', 'tributaria'),
  (550, 'IRRF', 'tributaria'),
  (570, 'ICMS', 'excluir'),
  (530, 'COFINS', 'excluir'),
  (500, 'PIS', 'excluir'),
  (1090, 'IPI', 'excluir'),
  (760, 'ICMS - Antecipacao Parcial', 'excluir'),
  (770, 'ICMS - Antecipacao Tributaria', 'excluir'),
  (750, 'PIS/COFINS/CSLL s/ Servico', 'excluir'),
  (260, 'Emprestimos e Financiamentos', 'excluir'),
  (140, 'Financiamento', 'excluir'),
  (940, 'Adiantamento de Lucros', 'excluir'),
  (250, 'Adiantamento a Fornecedor', 'excluir'),
  (670, 'Suprimento de Caixa', 'excluir'),
  (130, 'Adiantamento de Clientes', 'excluir'),
  (680, 'Adiantamento / Vale', 'excluir'),
  (100, 'Juros e Multas (credito)', 'excluir')
ON CONFLICT (ctafin) DO UPDATE SET descricao = EXCLUDED.descricao, grupo = EXCLUDED.grupo;

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
    SELECT f.ano, f.mes, SUM(f.valor_total) AS receita_bruta, SUM(f.impostos) AS impostos, SUM(f.deducoes) AS deducoes
    FROM public.financeiro_faturamento f
    JOIN public.financeiro_empresas e ON e.id = f.empresa_id
    WHERE (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    GROUP BY f.ano, f.mes
  ),
  pag AS (
    SELECT
      EXTRACT(YEAR FROM cp.data_emissao)::int AS ano,
      EXTRACT(MONTH FROM cp.data_emissao)::int AS mes,
      SUM(cp.valor) FILTER (WHERE COALESCE(cp.senior_ctafin, 0) = 0) AS cmv,
      SUM(cp.valor) FILTER (WHERE m.grupo = 'pessoal') AS desp_pessoal,
      SUM(cp.valor) FILTER (WHERE m.grupo = 'operacional') AS desp_operacional,
      SUM(cp.valor) FILTER (WHERE m.grupo = 'financeira') AS desp_financeira,
      SUM(cp.valor) FILTER (WHERE m.grupo = 'tributaria') AS desp_tributaria
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
      COALESCE(f.impostos, 0) AS impostos,
      COALESCE(f.deducoes, 0) AS deducoes,
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
