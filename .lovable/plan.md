

Investigando o erro de importação CSV de contatos.
<lov-tool-use id="toolu_vrtx_01XsHDBC6MXnpcKcvZEXZCGv" name="code--search_files" integration-id="code" data="{\"query\": \"customDaysStr\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01MRGsXkQh3839qKq4m2zUeo" name="code--search_files" integration-id="code" data="{\"query\": \"customDaysStr\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01P8bygmxBHF5NXVA7ny15LF" name="code--view" integration-id="code" data="{\"file_path\": \"deploy/backend/src/routes/groups-api.ts\", \"lines\": \"190-330\"}">
</lov-tool-use>
Mas o usuário disse "erro na importação" — qual importação? Não vi nada de groups-api referente a importação. A rota é provavelmente "Importação" mencionada no contexto anterior — Smart Link sync importa grupos. Mas o erro `customDaysStr.split is not a function` vem de scheduled message. Pode ser outra coisa: importação de contatos de e-mail? Ou a rota analyze-csv? Vou checar contexto — usuário está em `/transacoes` mas mencionou "importação". Provavelmente tentou importar algo. O código mostra `content.customDays || content.monthDay` — se um deles for um array ou número, `.split` falha.
<lov-tool-use id="toolu_vrtx_01CPJbji5ggSUhJx8vnN6Lgr" name="code--search_files" integration-id="code" data="{\"query\": \"customDays\", \"include_patterns\": \"src/**/*.ts,src/**/*.tsx,deploy/**/*.ts\"}">
</lov-tool-use>
Found it. Mas o usuário disse "importação" — provavelmente importação de mensagens agendadas via algum backup/JSON onde `customDays` veio como número (ex: `5` em vez de `"5"`), ou `monthDay` (number) caiu no fallback `customDaysStr`. No `case "monthly"` linha 193 é seguro (parseInt aceita number), mas em `custom` linha 208/310 trata como string e chama `.split`.

<lov-plan>

## Diagnóstico

O erro `customDaysStr.split is not a function` vem de `deploy/backend/src/routes/groups-api.ts` (linhas 208/212 e 310/314):

```ts
const customDaysStr: string = content.customDays || content.monthDay || "";
...
const days = customDaysStr.split(",")...
```

Quando uma mensagem agendada é importada (de backup/JSON/outra fonte), `content.customDays` ou `content.monthDay` vem como **número** (ex: `5`) em vez de string (`"5"`). A anotação de tipo `: string` mente — em runtime é `number`, e `number.split()` não existe.

Isso acontece nas duas funções (`calculateNextRunAt` e `calculateFirstRunAt`), `case "custom"`.

## Correção

Coagir para string antes do `.split` nos 2 pontos:

```ts
const customDaysRaw = content.customDays ?? content.monthDay ?? "";
const customDaysStr: string = String(customDaysRaw);
```

E aplicar a mesma defesa também em `case "monthly"` (linhas 193 e 300) por consistência (`parseInt(String(...))`).

### Arquivo alterado

- `deploy/backend/src/routes/groups-api.ts` — coerção `String(...)` em 4 pontos (linhas ~193, 208, 300, 310)

### Validação na VPS

```bash
cd ~/simplificandoconversas && git pull && bash deploy/update.sh
docker logs deploy-backend-1 --tail 50 | grep -i "customDays\|split"
```

Tentar a importação novamente — deve funcionar.

## Risco

Nenhum. `String()` é idempotente em strings e converte números/booleans com segurança.

