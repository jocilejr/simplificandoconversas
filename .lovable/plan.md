

# Plano: Criar colunas faltantes no `group_smart_links`

## Problema
A tabela `group_smart_links` **não possui** as colunas que o backend tenta usar: `sync_progress`, `last_sync_error`, `last_sync_error_at`, `last_successful_sync_at`. O PostgREST ignora ou falha silenciosamente, e o sync nunca funciona direito.

## Correção

### 1. Migração SQL — adicionar as 4 colunas faltantes

Executar na VPS:
```sql
ALTER TABLE group_smart_links
  ADD COLUMN IF NOT EXISTS sync_progress jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sync_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sync_error_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz DEFAULT NULL;
```

Seguido de:
```sql
NOTIFY pgrst, 'reload schema';
```

### 2. Backend — sem alterações adicionais

O código que foi implementado na última sessão (catch blocks limpando `sync_progress: null` + stale recovery de 10 min) já está correto. Só faltava a estrutura no banco.

### 3. Deploy

Após a migração:
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

### Comando completo para a VPS

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
ALTER TABLE group_smart_links
  ADD COLUMN IF NOT EXISTS sync_progress jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sync_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sync_error_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
"
```

## Resultado esperado
- O sync vai funcionar: o backend consegue escrever/limpar `sync_progress`
- O frontend mostra o progresso real e para de congelar
- A recuperação automática de syncs travados (>10 min) passa a funcionar

