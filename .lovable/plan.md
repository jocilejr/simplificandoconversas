

## Atualização Completa: Fila de Mensagens com Deduplicação

### Problema atual
O cron scheduler (a cada 1 min) enfileira mensagens na `group_message_queue` quando `next_run_at` chega, mas **não verifica se aquela mensagem já foi enfileirada para aquele horário**. Se o cron rodar 2x antes do `next_run_at` ser atualizado, duplica os envios. Além disso, o campo `mentionsEveryOne` do conteúdo não é processado no envio.

### Solução

#### 1. Deduplicação no Scheduler (index.ts, cron grupo scheduler ~L196-273)

Antes de inserir itens na fila, verificar se já existe um registro na `group_message_queue` para aquele `scheduled_message_id` + `group_jid` com `execution_batch` recente (últimos 2 minutos) ou com status `pending`/`processing`/`sent`. Se existir, pular.

```typescript
// Para cada jid, antes de adicionar ao queueItems:
const { count: existing } = await sb
  .from("group_message_queue")
  .select("id", { count: "exact", head: true })
  .eq("scheduled_message_id", msg.id)
  .eq("group_jid", jid)
  .in("status", ["pending", "processing", "sent"])
  .gte("created_at", new Date(Date.now() - 5 * 60000).toISOString());

if ((existing || 0) > 0) {
  console.log(`[cron] ⏭ Dedup: msg ${msg.id} → ${jid} already queued`);
  continue;
}
```

#### 2. Deduplicação no Processador (groups-api.ts, queue/process ~L702-800)

Antes de enviar cada item, verificar se outro item com mesmo `scheduled_message_id` + `group_jid` já foi enviado com sucesso recentemente:

```typescript
// Antes de processar cada item:
if (item.scheduled_message_id) {
  const { count: alreadySent } = await sb
    .from("group_message_queue")
    .select("id", { count: "exact", head: true })
    .eq("scheduled_message_id", item.scheduled_message_id)
    .eq("group_jid", item.group_jid)
    .eq("status", "sent")
    .neq("id", item.id);

  if ((alreadySent || 0) > 0) {
    await sb.from("group_message_queue")
      .update({ status: "cancelled", error_message: "Dedup: já enviada", completed_at: new Date().toISOString() })
      .eq("id", item.id);
    skipped++;
    continue;
  }
}
```

#### 3. Suporte a `mentionsEveryOne` no processador

O JSON do conteúdo inclui `mentionsEveryOne: true` mas o processador não envia essa flag para a Evolution API. Corrigir adicionando `mentionsEveryOne` no payload de envio:

```typescript
// No envio de texto:
body: JSON.stringify({
  number: item.group_jid,
  text: content.text || content.caption || "",
  mentionsEveryOne: content.mentionsEveryOne || content.mentionAll || false,
})

// No envio de mídia:
body: JSON.stringify({
  number: item.group_jid,
  mediatype: item.message_type,
  media: content.mediaUrl || "",
  caption: content.caption || "",
  fileName: content.fileName || "",
  mentionsEveryOne: content.mentionsEveryOne || content.mentionAll || false,
})
```

#### 4. Frontend — Status "cancelled" na fila (GroupQueueTab.tsx)

Adicionar o status `cancelled` ao `statusConfig` (já existe parcialmente em `GroupMessagesDialog`). Atualizar o `stats` no hook `useGroupQueue` para contar cancelados.

### Arquivos alterados
- `deploy/backend/src/index.ts` — deduplicação no cron scheduler
- `deploy/backend/src/routes/groups-api.ts` — deduplicação no processador + mentionsEveryOne
- `src/components/grupos/GroupQueueTab.tsx` — exibir status "cancelled"
- `src/hooks/useGroupQueue.ts` — contar cancelled nos stats

### Fluxo final
```text
Horário programado
  → Cron (1min) verifica next_run_at
  → Checa dedup: msg+grupo já na fila?
    → SIM: pula
    → NÃO: insere na fila (status: pending)
  → Atualiza next_run_at

Cron processador (30s)
  → Pega pending items
  → Para cada item:
    → Checa dedup: mesmo scheduled_msg+grupo já enviado?
      → SIM: marca cancelled
      → NÃO: envia via Evolution API
    → Respeita rate limit e delay
    → Marca sent/failed
```

