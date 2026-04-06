
## Diagnóstico provável

Pelo código atual, há 2 sinais fortes para explicar exatamente o que aconteceu na sua VPS:

1. **O backend pode falhar ao inserir em `transactions` e ainda assim responder sucesso**  
   Em `deploy/backend/src/routes/payment.ts`, se o insert retornar `txError`, o código só faz `console.error(...)` e continua retornando o boleto gerado. Ou seja: o Mercado Pago cria a cobrança, mas o sistema não garante que ela foi salva no banco.

2. **O deploy self-hosted não está versionando a tabela `transactions`**
   Nos arquivos de deploy que revisei (`deploy/init-db.sql` e `deploy/update.sh`), não há criação/migração explícita da tabela `transactions`. Isso indica **drift de schema** na VPS: a tabela pode existir, mas estar com colunas, índices ou constraints diferentes do que o backend espera hoje.

## O que vou ajustar na implementação

### 1. Corrigir o fluxo do backend para falhar de forma explícita
Arquivo: `deploy/backend/src/routes/payment.ts`

- Se o insert em `transactions` falhar, o endpoint deve:
  - logar o erro completo
  - **retornar erro 500**
  - **não responder sucesso**
- Salvar `customer_email: resolvedEmail` em vez de `customer_email` cru
- Adicionar logs úteis para diagnóstico na VPS:
  - início da criação
  - sucesso do Mercado Pago
  - tentativa de insert
  - erro detalhado do insert
  - id da transação salva

Isso evita o comportamento atual de “boleto criado, mas sem aparecer em Transações”.

### 2. Colocar a tabela `transactions` sob controle do deploy
Arquivos: `deploy/init-db.sql` e `deploy/update.sh`

Garantir que a VPS sempre tenha a estrutura esperada para `transactions`, incluindo:
- `id`
- `user_id`
- `amount`
- `type`
- `status`
- `source`
- `external_id`
- `customer_name`
- `customer_email`
- `customer_phone`
- `customer_document`
- `description`
- `payment_url`
- `metadata`
- `paid_at`
- `created_at`

Também vou garantir:
- RLS coerente
- grants para `anon`, `authenticated`, `service_role`
- índice por `user_id, created_at`
- índice opcional por `external_id, source`

### 3. Revisar o upsert em `conversations`
Arquivo: `deploy/backend/src/routes/payment.ts`

Hoje o código usa:
```ts
onConflict: "user_id,remote_jid"
```

Mas no SQL de deploy que revisei, a unicidade está como:
```sql
UNIQUE (user_id, remote_jid, instance_name)
```

Isso pode quebrar o `upsert` em alguns cenários. Vou alinhar isso de um dos dois jeitos:
- ajustar o `onConflict` para bater com a constraint real, ou
- criar uma constraint/index que corresponda ao uso do endpoint

## Verificações que você deve rodar na VPS agora

Antes da correção, para confirmar o drift de schema, rode na VPS:

```bash
cd ~/simplificandoconversas/deploy

docker compose exec postgres psql -U postgres -d postgres -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions'
ORDER BY ordinal_position;
"
```

```bash
docker compose exec postgres psql -U postgres -d postgres -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'transactions';
"
```

```bash
docker compose exec postgres psql -U postgres -d postgres -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'conversations';
"
```

E depois de gerar mais 1 boleto, rode sem `grep` para não perder linha importante:

```bash
docker compose logs backend --tail=200
```

## Resultado esperado após a correção

Depois do ajuste:
- se o Mercado Pago criar e o banco salvar, a cobrança aparecerá em **Transações**
- se o banco falhar, você verá o erro claramente na VPS
- o sistema não vai mais “fingir sucesso” quando a persistência falhar
- o schema da VPS ficará alinhado com o que o app realmente usa
