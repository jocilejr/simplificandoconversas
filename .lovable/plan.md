

## Diagnóstico

`date_trunc('minute', ts)` e `EXTRACT(MINUTE FROM ts)` em coluna `timestamptz` dependem do `TimeZone` da sessão → Postgres considera **não-imutável** e bloqueia `GENERATED STORED`.

Solução: forçar UTC explicitamente com `AT TIME ZONE 'UTC'` (vira `timestamp` sem TZ → operações ficam imutáveis), depois voltar para `timestamptz`.

## Fix — substituir o bloco do passo 1

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
ALTER TABLE group_participant_events
  ADD COLUMN IF NOT EXISTS dedup_bucket timestamptz
  GENERATED ALWAYS AS (
    (date_trunc('minute', (created_at AT TIME ZONE 'UTC'))
     - make_interval(mins => (EXTRACT(MINUTE FROM (created_at AT TIME ZONE 'UTC'))::int % 5))
    ) AT TIME ZONE 'UTC'
  ) STORED;
"
```

Por que funciona:
- `created_at AT TIME ZONE 'UTC'` retorna `timestamp` (sem TZ) → operações temporais viram imutáveis.
- `make_interval(mins => N)` é imutável (diferente de `N * interval '1 minute'` que o planner às vezes rejeita em coluna gerada).
- `... AT TIME ZONE 'UTC'` no final converte de volta para `timestamptz` (tipo da coluna).

## Próximos passos (sem mudança)
Após o ALTER funcionar, executar normalmente os passos 2, 3, 4 e 5 do plano anterior (deletes, UNIQUE INDEX, recálculo de `group_daily_stats`, validação).

## Validação imediata pós-ALTER

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT column_name, data_type, is_generated
FROM information_schema.columns
WHERE table_name='group_participant_events' AND column_name='dedup_bucket';
SELECT id, created_at, dedup_bucket 
FROM group_participant_events 
ORDER BY created_at DESC LIMIT 5;"
```

Esperado: `is_generated = ALWAYS` e `dedup_bucket` arredondado para múltiplo de 5 min do `created_at` em UTC.

