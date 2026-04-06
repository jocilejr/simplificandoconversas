

# Hotfix: adicionar coluna `auto_send` na VPS

## Problema
O `update.sh` cria a tabela `email_campaigns` com `CREATE TABLE IF NOT EXISTS`, mas como a tabela já existe, ele não adiciona colunas novas. A coluna `auto_send` nunca é criada na VPS, causando o erro "Could not find the 'auto_send' column".

## Solução
Adicionar o `ALTER TABLE` da coluna `auto_send` no `update.sh`, logo após o bloco de criação da tabela `email_campaigns` (após a linha 231). Assim, em qualquer deploy futuro a coluna será criada se não existir.

## Arquivo modificado
**`deploy/update.sh`** — Adicionar após a linha 337 (onde já existem outros `ALTER TABLE` para `email_campaigns`):

```sql
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT false;
```

## Ação imediata na VPS
Após o deploy, execute na VPS:

```bash
cd /root/simplificandoconversas/deploy

docker compose exec -T postgres psql -U postgres -d postgres -c "
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';
"

docker compose restart postgrest

./update.sh
```

## Detalhes técnicos
- O `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` é idempotente (seguro rodar várias vezes)
- O `NOTIFY pgrst, 'reload schema'` força o PostgREST a reconhecer a nova coluna
- O restart do PostgREST garante que o schema cache seja limpo

