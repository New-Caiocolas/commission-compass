-- Integração financeira Senior XT: empresas do grupo, contas a pagar/receber e log de sincronização

CREATE TABLE public.financeiro_empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  senior_codigo_empresa INT,
  senior_codigo_filial INT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO public.financeiro_empresas (codigo, nome, senior_codigo_empresa, senior_codigo_filial) VALUES
  ('ello', 'Ello Atacadão', 10, 1),
  ('faz_do_brasil', 'Faz do Brasil', 30, 1),
  ('imperatriz', 'Imperatriz', 20, 1);

-- Situação do título (coluna `status`): 'AB' = aberto, 'LQ' = liquidado (pago).
-- O web service customizado com.ello.metrics não popula data_pagamento (viria de
-- um join com a tabela de movimentos), então "em aberto" é determinado por
-- status = 'AB', NÃO por data_pagamento IS NULL.

CREATE TABLE public.financeiro_contas_pagar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.financeiro_empresas(id),
  senior_titulo TEXT NOT NULL,
  fornecedor TEXT,
  valor NUMERIC DEFAULT 0,
  data_emissao DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT,
  centro_custo TEXT,
  raw_payload JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (empresa_id, senior_titulo)
);

CREATE TABLE public.financeiro_contas_receber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.financeiro_empresas(id),
  senior_titulo TEXT NOT NULL,
  cliente TEXT,
  valor NUMERIC DEFAULT 0,
  data_emissao DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT,
  centro_custo TEXT,
  raw_payload JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (empresa_id, senior_titulo)
);

CREATE TABLE public.financeiro_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.financeiro_empresas(id),
  servico TEXT NOT NULL,
  numero_lote TEXT,
  status TEXT NOT NULL,
  mensagem TEXT,
  registros INT DEFAULT 0,
  executado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_financeiro_contas_pagar_empresa ON public.financeiro_contas_pagar(empresa_id);
CREATE INDEX idx_financeiro_contas_pagar_vencimento ON public.financeiro_contas_pagar(data_vencimento);
CREATE INDEX idx_financeiro_contas_receber_empresa ON public.financeiro_contas_receber(empresa_id);
CREATE INDEX idx_financeiro_contas_receber_vencimento ON public.financeiro_contas_receber(data_vencimento);

ALTER TABLE public.financeiro_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.financeiro_empresas FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.financeiro_contas_pagar FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.financeiro_contas_receber FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.financeiro_sync_log FOR SELECT USING (true);

-- ── KPIs ──────────────────────────────────────────────────────────────────

-- Liquidez: totais em aberto de contas a pagar/receber e saldo projetado
CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_liquidez(empresa_codigo TEXT DEFAULT NULL)
RETURNS TABLE(
  total_a_pagar_aberto NUMERIC,
  total_a_receber_aberto NUMERIC,
  saldo_projetado NUMERIC
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE((
      SELECT SUM(cp.valor) FROM public.financeiro_contas_pagar cp
      JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
      WHERE cp.status = 'AB'
        AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    ), 0) AS total_a_pagar_aberto,
    COALESCE((
      SELECT SUM(cr.valor) FROM public.financeiro_contas_receber cr
      JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
      WHERE cr.status = 'AB'
        AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    ), 0) AS total_a_receber_aberto,
    COALESCE((
      SELECT SUM(cr.valor) FROM public.financeiro_contas_receber cr
      JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
      WHERE cr.status = 'AB'
        AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    ), 0)
    -
    COALESCE((
      SELECT SUM(cp.valor) FROM public.financeiro_contas_pagar cp
      JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
      WHERE cp.status = 'AB'
        AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    ), 0) AS saldo_projetado;
$$;

-- PMR / PMP médios (dias entre emissão e recebimento/pagamento efetivo).
-- ATENÇÃO: depende de data_pagamento, que o serviço com.ello.metrics ainda não
-- popula (precisa do join com movimentos E501MCP/E301MCR). Enquanto isso, retorna
-- 0. Habilita quando a data de baixa estiver na sincronização.
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
        AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    ), 0) AS pmr_dias,
    COALESCE((
      SELECT AVG(cp.data_pagamento - cp.data_emissao)
      FROM public.financeiro_contas_pagar cp
      JOIN public.financeiro_empresas e ON e.id = cp.empresa_id
      WHERE cp.data_pagamento IS NOT NULL AND cp.data_emissao IS NOT NULL
        AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
    ), 0) AS pmp_dias;
$$;

-- Inadimplência: % de títulos a receber vencidos e não pagos
CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_inadimplencia(empresa_codigo TEXT DEFAULT NULL)
RETURNS TABLE(
  valor_vencido NUMERIC,
  valor_total_aberto NUMERIC,
  percentual NUMERIC
)
LANGUAGE sql STABLE
AS $$
  WITH base AS (
    SELECT cr.valor, cr.data_vencimento
    FROM public.financeiro_contas_receber cr
    JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
    WHERE cr.data_pagamento IS NULL
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
  )
  SELECT
    COALESCE(SUM(valor) FILTER (WHERE data_vencimento < CURRENT_DATE), 0) AS valor_vencido,
    COALESCE(SUM(valor), 0) AS valor_total_aberto,
    CASE WHEN COALESCE(SUM(valor), 0) = 0 THEN 0
      ELSE COALESCE(SUM(valor) FILTER (WHERE data_vencimento < CURRENT_DATE), 0) / SUM(valor)
    END AS percentual
  FROM base;
$$;

-- Aging de recebíveis em aberto por faixa de atraso
CREATE OR REPLACE FUNCTION public.get_kpi_financeiro_aging(empresa_codigo TEXT DEFAULT NULL)
RETURNS TABLE(
  faixa TEXT,
  valor NUMERIC,
  quantidade BIGINT
)
LANGUAGE sql STABLE
AS $$
  WITH base AS (
    SELECT
      cr.valor,
      CASE
        WHEN cr.data_vencimento >= CURRENT_DATE THEN 'A vencer'
        WHEN CURRENT_DATE - cr.data_vencimento <= 30 THEN '0-30 dias'
        WHEN CURRENT_DATE - cr.data_vencimento <= 60 THEN '31-60 dias'
        WHEN CURRENT_DATE - cr.data_vencimento <= 90 THEN '61-90 dias'
        ELSE '90+ dias'
      END AS faixa
    FROM public.financeiro_contas_receber cr
    JOIN public.financeiro_empresas e ON e.id = cr.empresa_id
    WHERE cr.data_pagamento IS NULL
      AND (empresa_codigo IS NULL OR e.codigo = empresa_codigo)
  )
  SELECT faixa, SUM(valor) AS valor, COUNT(*)::bigint AS quantidade
  FROM base
  GROUP BY faixa;
$$;
