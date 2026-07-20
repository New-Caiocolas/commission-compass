# sync-senior-financeiro

Puxa os títulos financeiros do Senior XT para o Supabase, via web service
**customizado** `com.ello.metrics` (porta `ConsultarFinanceiro`), e grava em
`financeiro_contas_pagar`. Uma única chamada traz as 3 empresas do grupo;
cada linha vem com `codEmp` (10 = Ello, 30 = Faz do Brasil, 20 = Imperatriz),
usado para atribuir a empresa.

## Ambiente (confirmado em 2026-07-20)

- **Senior GO UP 5.10.4** na **Senior Cloud**, acesso via TSplus. Não é a
  Senior X Platform — autenticação é **G5 clássica** (`user`/`password` do SGU
  no envelope, `encryption = 0`, sem token/`client_id`).
- **Endpoint externo (funciona pela internet):**
  `https://webp02.seniorcloud.com.br:30301/g5-senior-services/sapiens_Synccom_ello_metrics`
  (o mesmo host/porta do `com.ello.vendas` já usado por outro sistema interno).
- **SOAP RPC/literal**, namespace `http://services.senior.com.br`, operação
  `ConsultarFinanceiro`, ordem dos parâmetros `user password encryption parameters`.
- O serviço customizado roda o SQL (`E501TCP`, contas a pagar, `SitTit = 'AB'`)
  e devolve `codEmp, numTit, valor, dataEmissao, dataVencimento, dataPagamento,
  situacao, centroCusto`. `situacao`: `AB` = aberto, `LQ` = liquidado.

## Secret necessário

`SENIOR_METRICS` — JSON único. Template em `SENIOR_METRICS.template.json`:

```json
{
  "endpoint": "https://webp02.seniorcloud.com.br:30301/g5-senior-services/sapiens_Synccom_ello_metrics",
  "user": "usuario_sgu",
  "password": "senha",
  "encryption": 0
}
```

Setar com:
```
supabase secrets set SENIOR_METRICS='{"endpoint":"...","user":"...","password":"...","encryption":0}'
```

> **Use um usuário técnico do SGU, não um login pessoal.** A porta está com
> autenticação "Fazer logon", então valida user/senha. Senha pessoal expira
> (derruba o sync). Peça um usuário de integração com senha que não expira.

## Pendências antes de rodar em produção

1. **Republicar o `com.ello.metrics`** no editor de web services depois de ter
   adicionado a coluna `codEmp` — o WSDL/XSD publicado ainda **não** lista
   `codEmp`, e sem isso a coluna não vem na resposta SOAP e o sync não separa as
   empresas (registros caem em "sem empresa mapeada" no `financeiro_sync_log`).
2. **Tirar o `TOP 200`** do SQL da porta (era só para o teste) e manter o
   `SitTit = 'AB'`, para trazer todo o saldo em aberto.
3. **Confirmar que o Supabase alcança** `webp02.seniorcloud.com.br:30301` — o
   WSDL abre do navegador na rede do cliente; se a porta for restrita por IP,
   liberar os IPs de saída do Supabase (ou rodar o sync de dentro da rede).
4. **Usuário técnico do SGU** com permissão de execução no `com.ello.metrics`.

## Fase 2 (evoluções do serviço, no editor Senior)

- Contas a receber: UNION com `E301TCR` + coluna `tipo` ('P'/'R').
- `dataPagamento`/`centroCusto`: join com movimentos (`E501MCP`/`E301MCR`),
  habilita PMR/PMP.
- Nome do fornecedor/cliente por join com o cadastro (hoje `parceiro` vem nulo).

## Testar localmente

```
supabase functions serve sync-senior-financeiro --env-file supabase/.env.local
```

O parser (`_shared/parse.ts`) é robusto ao envelope: acha o array de registros
(`resultado`/`line`), trata campos `isnull='1'`, `valor` em vírgula (BR) ou
ponto (double), e datas `DD/MM/AAAA`.

## Agendamento

Ver `supabase/migrations/20260717000001_financeiro_sync_schedule.sql` — o
`cron.schedule` fica comentado até a function estar deployada e o secret
`SUPABASE_SERVICE_ROLE_KEY` confirmado.
