
## Diagnóstico fechado

Os dados que você trouxe fecham bem a causa:

- `transactions.workspace_id` existe no PostgreSQL
- `/rest/v1/transactions?select=workspace_id` responde `200`
- o `nginx/default.conf.template` realmente aponta `/rest/v1/` para `postgrest:3000`
- mesmo assim o **backend** continua logando:
  `Could not find the 'workspace_id' column of 'transactions' in the schema cache`

Isso indica um problema de **caminho interno / rollout / cache operacional**, não de schema faltando.

```text
n8n -> /functions/v1/manual-payment -> backend
backend -> SUPABASE_URL (hoje: http://nginx:80) -> postgrest
```

O ponto mais frágil hoje é o backend depender do `nginx:80` para falar com o PostgREST, quando ele poderia falar **direto** com `postgrest:3000`.

## O que vou alterar

### 1. Tirar o Nginx do caminho interno do backend
Arquivos:
- `deploy/docker-compose.yml`
- `deploy/portainer-stack.yml`

Mudança:
- trocar `SUPABASE_URL: http://nginx:80`
- por `SUPABASE_URL: http://postgrest:3000`

Objetivo:
- eliminar proxy interno desnecessário
- fazer o backend falar direto com o PostgREST
- reduzir chance de rota ambígua, cache antigo ou task errada no meio

### 2. Fortalecer o bootstrap e update da VPS
Arquivos:
- `deploy/install.sh`
- `deploy/update.sh`

Vou garantir que os scripts validem o sistema do jeito certo:

- aplicar o pacote completo de SQL
- enviar `NOTIFY pgrst, 'reload schema'`
- forçar refresh/restart do serviço `postgrest`
- rodar **smoke test real** usando o mesmo caminho interno do backend

Validações finais do script:
- tabela `api_request_logs`
- `transactions.workspace_id`
- `platform_connections.workspace_id`
- teste HTTP interno no PostgREST com `workspace_id`

### 3. Melhorar a observabilidade do backend
Arquivos:
- `deploy/backend/src/lib/supabase.ts`
- `deploy/backend/src/routes/health-db.ts`
- `deploy/backend/src/routes/manual-payment-webhook.ts`

Vou deixar o backend mais explícito para depuração:
- expor no health qual `SUPABASE_URL` real está em uso
- logar melhor falhas do `manual-payment`
- incluir contexto suficiente para diferenciar erro de deploy antigo vs erro atual

### 4. Adicionar uma proteção no webhook manual-payment
Arquivo:
- `deploy/backend/src/routes/manual-payment-webhook.ts`

Se o erro específico de schema cache voltar a acontecer, vou adicionar uma tentativa controlada de recuperação antes de devolver `500`:
- recriar o client
- repetir a operação uma vez
- registrar erro com contexto claro

Se eu identificar que isso ainda não é suficiente, deixo preparado o caminho para fallback direto por SQL em uma segunda etapa, mas a primeira correção será manter o padrão atual do projeto.

## Resultado esperado

Depois disso:

- o backend deixa de depender do `nginx:80` para acesso interno ao banco REST
- deploy novo não termina sem validar o schema real
- o webhook `/manual-payment` deixa de quebrar por falso erro de cache
- você consegue verificar na VPS exatamente qual build e qual URL interna estão ativos

## Validação na VPS após implementar

Vou considerar a correção pronta quando estes testes passarem:

1. `bash deploy/update.sh`
2. health do backend mostrando o `SUPABASE_URL` novo
3. teste interno do PostgREST com `workspace_id` retornando `200`
4. nova execução real no n8n/manual-payment sem `500`
5. logs do backend sem repetir `schema cache`

## Arquivos previstos

- `deploy/docker-compose.yml`
- `deploy/portainer-stack.yml`
- `deploy/install.sh`
- `deploy/update.sh`
- `deploy/backend/src/lib/supabase.ts`
- `deploy/backend/src/routes/health-db.ts`
- `deploy/backend/src/routes/manual-payment-webhook.ts`

## Risco

Baixo.

A mudança principal é infra interna do backend, sem alterar regra de negócio de transações. O maior impacto é positivo: remover uma camada intermediária e validar melhor o deploy.
