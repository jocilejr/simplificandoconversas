

# Fix: PostgREST schema cache não reconhece `payment_url`

## Problema
O log confirma:
```
Could not find the 'payment_url' column of 'transactions' in the schema cache
```

A coluna provavelmente **já existe** no Postgres (foi adicionada pelo `update.sh`), mas o **PostgREST** está usando um cache antigo do schema e não a reconhece.

## Correção em `deploy/update.sh`

Adicionar dois comandos após o bloco de migrações SQL:

1. **Dentro do bloco SQL** (no final, antes do `EOSQL`): adicionar `NOTIFY pgrst, 'reload schema';`
2. **Após o bloco SQL**: reiniciar o container do PostgREST para garantir limpeza completa do cache

### Alteração no arquivo

No final do bloco SQL (antes da linha `EOSQL`), adicionar:
```sql
-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
```

Logo após o `EOSQL`, adicionar:
```bash
# Restart PostgREST to clear schema cache
echo "  → Reloading PostgREST schema cache..."
docker compose restart postgrest 2>/dev/null || true
```

## Ação imediata na VPS

Enquanto isso, para resolver **agora sem esperar deploy**, rode:

```bash
cd ~/simplificandoconversas/deploy

# Verificar se a coluna existe
docker compose exec postgres psql -U postgres -d postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='payment_url';"

# Se não existir, criar
docker compose exec postgres psql -U postgres -d postgres -c "ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_url text; ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_document text;"

# Forçar reload do PostgREST
docker compose exec postgres psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
docker compose restart postgrest

# Testar gerando novo boleto
```

## Resultado
Após o reload do PostgREST, o insert vai funcionar e os boletos aparecerão na aba Transações.

