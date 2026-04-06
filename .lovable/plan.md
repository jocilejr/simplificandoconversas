

# Corrigir erro "ON CONFLICT DO UPDATE cannot affect a row a second time"

## Problema

Quando o usuário cola e-mails repetidos na lista (ex: `teste@gmail.com` aparece 2x), o array `rows` enviado ao `upsert` contém duplicatas. O Postgres não permite que um único `upsert` afete a mesma row duas vezes no mesmo comando.

## Solução

No `confirmBulkImport` em `src/hooks/useEmailContacts.ts`, deduplicar o array `rows` por `email` antes de enviar ao banco.

### Alteração

No trecho que monta `rows` (linha ~210-217), após o `.map()`, adicionar deduplicação:

```typescript
// Deduplicate by email before upsert
const seen = new Set<string>();
const uniqueRows = rows.filter((r) => {
  if (seen.has(r.email)) return false;
  seen.add(r.email);
  return true;
});
```

E usar `uniqueRows` no loop de batches em vez de `rows`.

### Arquivo alterado
- `src/hooks/useEmailContacts.ts` — deduplicar antes do upsert

