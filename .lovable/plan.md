

# Fix: Prefixo `platform/` faltando nas URLs do hook

## Problema confirmado

O frontend chama `apiUrl("mark-tab-seen")` → `/functions/v1/mark-tab-seen` → 404.
A rota correta é `apiUrl("platform/mark-tab-seen")` → `/functions/v1/platform/mark-tab-seen` → 200.

## Correção

### `src/hooks/useUnseenTransactions.ts`

Duas alterações simples:
- `apiUrl("mark-seen")` → `apiUrl("platform/mark-seen")`
- `apiUrl("mark-tab-seen")` → `apiUrl("platform/mark-tab-seen")`

Nenhuma outra alteração necessária.

