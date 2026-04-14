

# Correção: 185 mensagens agendadas órfãs travando o scheduler

## Problema identificado

O scheduler encontra **185 mensagens ativas** a cada ciclo (1 min), mas todas pertencem a **campanhas inativas** (`224987bf`, `8e4cb1f1`, `dd464b66`). As únicas campanhas ativas são `b30936b9` e `b63ff159`.

No código (linha 233), quando a campanha é inativa, o scheduler faz `continue` — pula a mensagem sem desativá-la. Na próxima execução (1 min depois), as mesmas 185 mensagens são encontradas novamente, criando um loop infinito que:

1. Consome recursos desnecessariamente a cada minuto
2. Impede mensagens legítimas de serem processadas (o limite de 5/ciclo é consumido pelas órfãs)
3. Gera spam no log

Além disso, todas as 185 mensagens têm `cron_expression = NULL` e `last_run_at = NULL`, indicando que o self-heal na inicialização definiu `next_run_at` para o horário de boot sem conseguir reconstruir o cron.

## Correção

### 1. `deploy/backend/src/index.ts` — Desativar mensagens de campanhas inativas

Na linha 233-236, quando a campanha é inativa ou não existe, **desativar a mensagem agendada** em vez de apenas pular:

```typescript
if (campErr || !campaign || !campaign.is_active) {
  // Deactivate orphaned message
  await sb.from("group_scheduled_messages")
    .update({ is_active: false, next_run_at: null })
    .eq("id", msg.id);
  if (campErr) console.error(`[cron] group-scheduler campaign fetch error for ${msg.id}:`, campErr.message);
  else console.log(`[cron] 🧹 Deactivated orphaned msg ${msg.id} (campaign inactive/missing)`);
  continue;
}
```

### 2. Limpeza imediata na VPS (após deploy)

Executar na VPS para limpar as 185 mensagens órfãs de uma vez:

```bash
docker compose exec postgres psql -U postgres -d postgres --pset=pager=off -c "
UPDATE group_scheduled_messages SET is_active = false, next_run_at = NULL 
WHERE is_active = true AND campaign_id NOT IN (
  SELECT id FROM group_campaigns WHERE is_active = true
);"
```

## Resultado esperado

- O scheduler para de processar mensagens órfãs
- Mensagens de campanhas ativas serão processadas corretamente
- Logs limpos, sem spam de "185 messages due"

