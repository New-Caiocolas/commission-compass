CREATE TABLE public.apuracao_frete_comissao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  num_nf TEXT,
  repres_vend TEXT,
  nome_rep TEXT,
  nome_cliente TEXT,
  dt_pag DATE,
  prc_nf NUMERIC DEFAULT 0,
  vlr_desc NUMERIC DEFAULT 0,
  vlr_acresc NUMERIC DEFAULT 0,
  vlr_negativa NUMERIC DEFAULT 0,
  vlr_ajustada NUMERIC DEFAULT 0,
  vlr_comissao_nf NUMERIC DEFAULT 0,
  vlr_exced NUMERIC DEFAULT 0,
  vlr_frete_cte NUMERIC DEFAULT 0,
  vlr_frete_desp_acessoria NUMERIC DEFAULT 0,
  desconto_1 NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.apuracao_frete_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.apuracao_frete_comissao
  FOR SELECT USING (true);