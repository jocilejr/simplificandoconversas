

# Plano: Corrigir `updated_at` no PUT de campanhas e garantir sync do scheduler

## Problema raiz

O endpoint `PUT /campaigns/:id` (linha 831-843 de `groups-api.ts`) monta o objeto `update` **sem incluir `updated_at`**. Resultado:
- `updated_at` fica congelado na data de criação (14/04)
- Toda a lógica de diagnóstico que depende de `updated_at` para detectar "ativado recentemente" falha
- O `wasActive !== nowActive` funciona, mas como `updated_at` não muda, o painel de debug e o `resolveSchedulerStatus` não conseguem distinguir ativações recentes

Além disso, o `group_scheduled_messages` também precisa ter seu `updated_at` atualizado quando recalculado na ativação da campanha.

## Correções

### 1. Backend — `deploy/backend/src/routes/groups-api.ts`

**No PUT de campanhas (linha ~831):** Adicionar `updated_at` ao update object:
```typescript
const update: any = { updated_at: new Date().toISOString() };
```

**Na ativação de campanha (linha ~872):** Ao recalcular `next_run_at` das mensagens, também atualizar `updated_at`:
```typescript
await sb.from("group_scheduled_messages")
  .update({ next_run_at: nextRun, updated_at: new Date().toISOString() })
  .eq("id", m.id);
```

**Para mensagens que já têm `next_run_at` válido (linha ~879):** Mesmo sem recalcular, atualizar `updated_at` para marcar a reativação:
```typescript
await sb.from("group_scheduled_messages")
  .update({ updated_at: new Date().toISOString() })
  .eq("id", m.id);
```

### 2. Garantir que `group_campaigns` tenha trigger de `updated_at` (verificação)

Confirmar se existe trigger `update_updated_at_column` na tabela `group_campaigns`. Se não existir, a única forma de atualizar é explicitamente no código (que é o que estamos fazendo acima).

## Resultado
- O toggle ativa/desativa vai atualizar `updated_at` na campanha e nas mensagens
- O painel de debug vai identificar corretamente ativações recentes
- O `resolveSchedulerStatus` vai poder ignorar diagnósticos stale com base no timestamp real de ativação

## Validação pós-deploy
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

Depois, ative uma campanha pela UI e verifique:
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT id, name, is_active, updated_at FROM group_campaigns ORDER BY updated_at DESC LIMIT 5;
"
```

```bash
docker logs deploy-backend-1 --since=5m 2>&1 | grep -i "activated\|synced\|timer" | tail -20
```

