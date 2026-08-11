# Guia: web service customizado do Senior XT (`com.ello.metrics`)

Documento de transferência de conhecimento. Tudo aqui foi descoberto na prática
(tentativa e erro) e **validado contra o banco**. Se você vai criar ou alterar
uma porta desse serviço, leia as "pegadinhas" antes — elas custaram muitas horas.

---

## 1. O ambiente (contexto que muda tudo)

| Item | Valor |
|---|---|
| ERP | Senior **Gestão Empresarial / GO UP 5.10.4** (Sapiens) |
| Hospedagem | **Senior Cloud**, acesso via TSplus (`sirius.seniorcloud.com.br`) |
| Banco | SQL Server 2019 (base `CBDS`) |
| **NÃO é** | Senior X Platform — não existe token/`client_id`/`api.senior.com.br` aqui |
| Autenticação | **G5 clássica**: `user` + `password` do SGU + `encryption = 0` no envelope |

**Endpoint SOAP (funciona pela internet):**
```
https://webp02.seniorcloud.com.br:30301/g5-senior-services/sapiens_Synccom_ello_metrics
```
- `?wsdl` no final mostra as operações publicadas; `?xsd` mostra os campos.
- O prefixo de ambiente é **`sapiens`** (não `rubi`, que é do HCM/folha).
- O host do portal de acesso remoto (`sirius…`) **não** serve o web service —
  o `g5-senior-services` está publicado no `webp02…:30301`.

**Empresas:** Ello = `codEmp 10`, Imperatriz = `20`, Faz do Brasil = `30`.
⚠️ `codFil` **não** serve como filtro universal: no contas a **receber** os
títulos estão em outra filial. Filtre só por `CodEmp`.

---

## 2. Como chamar (envelope SOAP)

RPC/literal, namespace `http://services.senior.com.br`, parâmetros na ordem
`user, password, encryption, parameters`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ser="http://services.senior.com.br">
  <soapenv:Body>
    <ser:NomeDaPorta>
      <user>USUARIO_SGU</user>
      <password>SENHA</password>
      <encryption>0</encryption>
      <parameters></parameters>
    </ser:NomeDaPorta>
  </soapenv:Body>
</soapenv:Envelope>
```
POST com `Content-Type: text/xml; charset=utf-8` e `SOAPAction:` vazio.

**Como saber se a porta está no ar** (sonda com credencial falsa):
- `"Credenciais inválidas"` → ✅ porta publicada e funcionando
- `"A porta X não foi encontrada na lista de serviços"` → não publicada
- `"não está disponível para o módulo Sapiens"` → publicada, ainda propagando (aguarde ~2-5 min)

**Formato da resposta:** encoding `ISO-8859-1`; registros em `resultado`/`line`;
campo vazio vem como `<campo isnull='1'/>`; texto pode vir em `CDATA`; número em
formato BR (`170,07`) na tela de teste e com ponto no SOAP; datas `DD/MM/AAAA`.
Erro da regra vem em `<erroExecucao>`.

---

## 3. As portas existentes

| Porta | O que retorna | Tabela fonte |
|---|---|---|
| `ConsultarFinanceiro` | contas a **pagar** (+ `ctafin` = classificação) | `E501TCP` + `E095FOR` |
| `ConsultarContasReceber` | contas a **receber** | `E301TCR` + `E085CLI` |
| `ConsultarFaturamento` | faturamento **por dia** (+ impostos/deduções) | `E140NFV` |
| `ConsultarCMV` | custo das saídas de venda **por dia** | `E210MVP` |
| `Diagnostico` | porta descartável p/ investigar o banco | — |

Colunas de saída (parâmetro `Resultado`, tipo Tabela) precisam ter **exatamente**
o mesmo nome usado na regra em `NomeDaPorta.Resultado.xxx`.

---

## 4. O padrão que FUNCIONA: SQL nativo

O cursor padrão (`Definir Cursor` + `cur.SQL`) tem um parser próprio muito
limitado. **Use sempre a família `SQL_*` com `SQL_UsarSQLSenior2(cursor, 0)`** —
ela manda o SQL direto pro SQL Server, e aí tudo funciona (JOIN, SUM, GROUP BY,
funções de data).

```lsp
Definir Alfa xCursor;
Definir Alfa aSQL;
Definir Numero vCodEmp;
Definir Alfa vTexto;
Definir Numero vValor;
Definir Numero vData;

aSQL = "SELECT t.CodEmp, t.NumTit, c.NomFor parceiro, t.VlrOri, t.DatEmi ";
aSQL = aSQL + "FROM E501TCP t LEFT JOIN E095FOR c ON c.CodFor = t.CodFor ";
aSQL = aSQL + "WHERE t.CodEmp IN (10,20,30)";

SQL_Criar(xCursor);
SQL_UsarAbrangencia(xCursor, 0);
SQL_UsarSQLSenior2(xCursor, 0);
SQL_DefinirComando(xCursor, aSQL);
SQL_AbrirCursor(xCursor);

Enquanto (SQL_EOF(xCursor) = 0)
inicio
    SQL_RetornarInteiro(xCursor, "CodEmp", vCodEmp);
    SQL_RetornarAlfa(xCursor, "parceiro", vTexto);
    SQL_RetornarFlutuante(xCursor, "VlrOri", vValor);
    SQL_RetornarData(xCursor, "DatEmi", vData);

    MinhaPorta.Resultado.CriarLinha();
    MinhaPorta.Resultado.codEmp = vCodEmp;
    MinhaPorta.Resultado.parceiro = vTexto;
    MinhaPorta.Resultado.valor = vValor;
    MinhaPorta.Resultado.dataEmissao = vData;

    SQL_Proximo(xCursor);
fim;

SQL_FecharCursor(xCursor);
SQL_Destruir(xCursor);
```

Funções confirmadas: `SQL_RetornarInteiro`, `SQL_RetornarAlfa`,
`SQL_RetornarFlutuante`, `SQL_RetornarData`, `SQL_Proximo`, `SQL_EOF`.

---

## 5. ⚠️ Pegadinhas (leia antes de mexer)

**Do editor / LSP:**
1. **Cada linha tem limite de ~255 caracteres.** Monte o SQL em várias linhas
   curtas com `aSQL = aSQL + "..."`. Erro: *"linha para o compilador é muito grande"*.
2. **String não quebra linha.** Uma `"..."` tem que terminar na mesma linha.
   Erro: *"cadeia de caracteres sem terminação"*.
3. **Sempre apague tudo antes de colar** (Ctrl+A → Delete). Restos da versão
   anterior colam no SQL novo e geram erros absurdos (ex.: `E210TRAFROM`).
4. **Coluna da porta × nome na regra têm que bater.** Erro:
   *"campo ou operação não existem"* = a coluna não existe no `Resultado`.
5. **Tipos precisam casar.** Número em coluna Alfanumérica dá
   *"tipos incompatíveis: ALFA e NUMERO"*.

**Do parser antigo (só se você insistir no cursor padrão — não recomendado):**
- não aceita `+` dentro do `cur.SQL`, nem `LEFT JOIN`, nem `SUM`/`GROUP BY` com
  função, nem `DATEADD`, nem comparar data com literal. `IntParaStr` também não
  é aceito. **Solução para tudo isso: usar SQL nativo (seção 4).**

**Da publicação:**
6. **Publicar 2x.** A primeira publicação frequentemente não expõe a porta nova.
   Salve (Arquivo → Salvar) e publique de novo; depois aguarde a propagação.
7. **O WSDL/XSD só muda ao publicar.** Se você adicionou uma coluna e ela não
   aparece na resposta SOAP (mas aparece no Testar), faltou publicar.

**De performance:**
8. **A tela de teste não tem "cancelar".** Se a consulta for pesada, ela trava e
   só o Gerenciador de Tarefas resolve. Sempre teste com `TOP 200` ou filtro, e
   evite `ORDER BY` em tabela grande.

---

## 6. Mapa das tabelas (o que existe de verdade nesta base)

| Tabela | Conteúdo | Campos-chave |
|---|---|---|
| `E501TCP` | títulos a pagar | `NumTit`, `CodFor`, `VlrOri`, `DatEmi`, `VctPro`, **`UltPgt`** (data da baixa), `SitTit`, **`ctafin`** |
| `E301TCR` | títulos a receber | idem, com `CodCli` |
| `E095FOR` | cadastro de fornecedores | `CodFor`, `NomFor` — **sem `CodEmp`** (join só por `CodFor`) |
| `E085CLI` | cadastro de clientes | `CodCli`, `NomCli` (⚠️ **não** é `E075CLI`) |
| `E140NFV` | notas fiscais de saída | `VlrLiq`, `VlrIcm`, `VlrPis`, `VlrCff`, `VlrDed`, `DatEmi`, `SitNfv` (**3 = cancelada**) |
| `E210MVP` | movimento de estoque (352k linhas) | `CodPro`, `QtdMov`, `VlrMov`, `DatMov`, `NumNfv`, `EstEos` (`S`=saída, `E`=entrada) |
| `E091PLF` | plano financeiro (classificação) | `ctafin`, `descta`, `natfin` |
| `E210TRA` | ⚠️ **vazia** — não use | — |
| `E665LAN` | ⚠️ **vazia** — contabilidade não é lançada no Senior | — |

`SitTit`: `AB` = aberto, `LQ` = liquidado (pago).

---

## 7. Armadilhas de interpretação (mais importante que o código)

Estas são as que geram **número errado sem dar erro nenhum**:

1. **`ctafin` classifica FLUXO DE CAIXA, não DRE.** O plano financeiro mistura
   despesa real com pagamento de empréstimo, adiantamento a fornecedor e
   distribuição de lucros. Somar tudo como "despesa" **inverte o resultado**
   (num teste real: prejuízo falso de −10% que na verdade era lucro de +25%).
   Classifique cada `ctafin` antes de usar (ver tabela `financeiro_conta_dre`).
2. **Imposto da nota ≠ imposto pago.** ⚠️ *Este erro inverteu o resultado de um
   trimestre inteiro.* O `VlrIcm+VlrPis+VlrCff` destacado na nota de venda é
   **cerca de metade** do que a empresa realmente paga, porque ICMS-ST e
   antecipações não aparecem destacados. Exemplo real (Ello, 2º tri/2026):
   nota = R$ 485 mil, pago = R$ 998 mil. **Use sempre os títulos pagos**
   (`ctafin` de ICMS/PIS/COFINS/antecipações), nunca o valor da nota.
3. **CMV pelo estoque subestima.** O `E210MVP.VlrMov` é o custo contábil do
   estoque, sem ST/frete — para commodity, dá margem irreal (~58%). O custo real
   está nas **compras** (títulos a pagar com `ctafin` vazio).
4. **Intercompany infla tudo.** Ello compra da Imperatriz: isso aparece como
   "devedor" e como "fornecedor" nos rankings, e distorce a inadimplência do
   consolidado (89% da Imperatriz eram quase todos intercompany).
5. **Mês isolado engana.** Contas anuais e provisões fazem um mês parecer
   catastrófico. Olhe o acumulado.
6. **Parcela de financiamento mistura juros e principal.** Só os juros são
   despesa; o principal amortiza dívida. Não dá para separar automaticamente —
   a controladoria informa a fração (campo `percentual` em `financeiro_conta_dre`).
7. **Sempre reconcilie com o banco E com a controladoria.** Bater com o CBDS só
   prova que o cálculo reflete o dado; não prova que a *metodologia* está certa.
   O erro dos impostos passou pela reconciliação técnica e só apareceu quando a
   controladoria comparou com a apuração real. **Peça a validação humana.**

---

## 8. Fluxo de trabalho recomendado

1. **Investigue no CBDS primeiro** (SQL direto), não no editor — é 10x mais rápido.
   Útil: `INFORMATION_SCHEMA.COLUMNS`, e contagem de linhas por tabela via
   `sys.partitions` para saber o que está populado.
2. Crie/ajuste a porta no **Editor de web services** (colunas do `Resultado` primeiro).
3. **Testar** (modo Local) com filtro pequeno.
4. **Salvar → Publicar → Publicar de novo.**
5. Sonde o endpoint (seção 2) até responder *"Credenciais inválidas"*.
6. Só então rode a sincronização.
7. **Reconcilie** o resultado com uma query no CBDS.

---

## 9. Onde isso é consumido

Edge Function `sync-senior-financeiro` (Supabase, projeto `swvrrkzuolhlpteckuop`):
- Secrets **separados** (`SENIOR_ENDPOINT`, `SENIOR_USER`, `SENIOR_PASSWORD`,
  `SENIOR_ENCRYPTION`) — **não** use um JSON único: no Windows o
  PowerShell/npx come as aspas e corrompe o valor.
- Orquestra 4 etapas em **invocações separadas** (`?stage=...`), porque rodar
  todas no mesmo worker estoura o limite de memória.
- Sync tipo **snapshot** (apaga e regrava): `numTit` **não** é único por empresa.
- CLI: use `npx supabase` (não há instalação global).
