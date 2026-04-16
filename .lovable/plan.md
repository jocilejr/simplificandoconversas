

# Plano: Corrigir cálculo de dias — usar data BRT sem horário

## Bug

Linha 221-222 de `followup-daily.ts`:
- `boleto.created_at` é UTC (`2026-04-14T23:30:00Z`)
- `daysBetween` faz `slice(0, 10)` → extrai `2026-04-14` ou `2026-04-15` dependendo do horário UTC
- Mas em BRT, `23:30 UTC` = `20:30 BRT` do dia anterior
- Resultado: boletos criados à noite ficam com 1 dia a menos na contagem

## Correção

### Arquivo: `deploy/backend/src/routes/followup-daily.ts`

**1. Adicionar helper `toBrasiliaDate`** (converte qualquer timestamp para `YYYY-MM-DD` em BRT):

```typescript
function toBrasiliaDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
```

**2. Linha 221-222 — converter `created_at` para data BRT antes do cálculo:**

```typescript
// ANTES (bug):
const dueDate = new Date(new Date(boleto.created_at).getTime() + expirationDays * 24*60*60*1000).toISOString().slice(0, 10);
const matchingRule = findMatchingRule(rules, boleto.created_at, dueDate, today);

// DEPOIS (correto):
const createdDateBRT = toBrasiliaDate(boleto.created_at);
const dueDateObj = new Date(createdDateBRT + "T12:00:00");
dueDateObj.setDate(dueDateObj.getDate() + expirationDays);
const dueDate = dueDateObj.toISOString().slice(0, 10);
const matchingRule = findMatchingRule(rules, createdDateBRT, dueDate, today);
```

Agora `findMatchingRule` recebe `createdDateBRT` (ex: `2026-04-14`) e `today` (já em BRT via `getTodayBrasilia`). O `daysBetween` compara duas datas puras sem influência de timezone.

**3. Também reverter a mudança anterior no frontend** — o `useBoletoRecovery.ts` não deveria ter sido alterado para filtrar só por dispatchMap. O frontend estava correto mostrando os 9 itens. O problema era o backend não gerando os jobs.

Preciso reverter `src/hooks/useBoletoRecovery.ts` e `src/components/followup/FollowUpDashboard.tsx` ao estado anterior (antes da mudança de "Pendentes fantasma"), pois o frontend precisa continuar mostrando boletos que deveriam estar na queue mas ainda não estão (para debug e visibilidade).

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/followup-daily.ts` | Adicionar `toBrasiliaDate`, converter `created_at` para BRT antes de calcular dias |
| `src/hooks/useBoletoRecovery.ts` | Reverter: voltar a calcular regras localmente e usar `applicableRule` para "Hoje" |
| `src/components/followup/FollowUpDashboard.tsx` | Reverter: restaurar badges e contadores originais |

## Verificação na VPS

```bash
# Rebuild e rodar prepare
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend

# Rodar prepare manualmente
curl -s -X POST http://localhost:3001/api/followup-daily/prepare | jq

# Ver se Maria Lucia agora aparece na queue
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT customer_name, status, normalized_phone
FROM followup_dispatch_queue
WHERE dispatch_date = CURRENT_DATE
ORDER BY customer_name;
"
```

## Resultado esperado

- Todos os 9 boletos que o frontend mostra como "Hoje" agora também aparecem na dispatch queue
- `daysBetween` compara datas puras em BRT, sem influência de horário UTC

