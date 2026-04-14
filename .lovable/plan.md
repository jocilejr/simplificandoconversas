

## Ordenar mensagens por horário

### Problema
As mensagens na aba semanal (e nas outras abas) aparecem sem nenhuma ordem — deveriam estar ordenadas por horário (08:00, 09:00, 12:00, 13:00...).

### Solução

**Arquivo: `src/components/grupos/GroupMessagesDialog.tsx`** — Após filtrar as mensagens por aba/dia da semana (linha ~141-145), ordenar `displayMessages` pelo horário extraído do campo `content.time` ou `content.runTime`:

```typescript
displayMessages = [...displayMessages].sort((a, b) => {
  const timeA = a.content?.time || a.content?.runTime || "99:99";
  const timeB = b.content?.time || b.content?.runTime || "99:99";
  return timeA.localeCompare(timeB);
});
```

Para a aba "once", ordenar por `scheduled_at` em vez de `content.time`.

Isso garante que todas as mensagens apareçam em ordem cronológica crescente.

