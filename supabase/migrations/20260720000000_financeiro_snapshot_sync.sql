-- O numTit do Senior NÃO é único por empresa (a chave real do título inclui
-- tipo e fornecedor — ex.: "DARF 5952" repete). O sync passa a ser snapshot:
-- apaga e regrava os títulos em aberto a cada execução, então a unicidade
-- por (empresa_id, senior_titulo) deixa de valer.

ALTER TABLE public.financeiro_contas_pagar
  DROP CONSTRAINT IF EXISTS financeiro_contas_pagar_empresa_id_senior_titulo_key;

ALTER TABLE public.financeiro_contas_receber
  DROP CONSTRAINT IF EXISTS financeiro_contas_receber_empresa_id_senior_titulo_key;
