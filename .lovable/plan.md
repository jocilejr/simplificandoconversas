

## Diagnóstico — 3 bugs distintos

### Bug 1 — Áudio em grupo nunca envia (root cause)
`deploy/backend/src/routes/groups-api.ts:1248-1262`: para qualquer mídia (incluindo `audio`), o backend chama `/message/sendMedia` lendo `content.mediaUrl`. Mas o content salvo no banco tem **`content.audio`** (não `mediaUrl`) — vide query: `{"audio": "https://.../...ogg", ...}`. Resultado: `media: ""` vai vazio para Evolution → Baileys quebra com `Received type boolean (false)`. Não tem nada a ver com `mentionsEveryOne`.

Além disso, áudio deveria usar endpoint `/message/sendWhatsAppAudio` (igual `execute-flow.ts:95`) com payload `{ number, audio }`, não `sendMedia`.

### Bug 2 — Programação "única" salva sem data
`GroupScheduledMessageForm.tsx:177-179`: `if (scheduleType === "once" && scheduledAt)` — quando `scheduledAt` está vazio o `if` simplesmente não executa, `scheduled_at` fica `null` e o submit segue. Falta validação obrigatória.

### Bug 3 — Waveform do preview de áudio
`WhatsAppPreview.tsx:76`: `WAVEFORM_HEIGHTS` usa fórmula `Math.sin(i*0.6)*10 + Math.cos(i*1.2)*5 + 8` que gera valores entre ~-7 e ~23 (incluindo negativos!). Renderizado como `height: ${h}%` → barras com altura negativa quebram visualmente. Precisa gerar valores positivos plausíveis (5-100%).

## Correções

### Fix 1 — Backend: dispatch correto de áudio
`deploy/backend/src/routes/groups-api.ts` (~linha 1238-1262)

```typescript
const content = item.content as any;
const mentionsEveryOne = content.mentionsEveryOne || content.mentionAll || false;

// Resolver URL de mídia aceitando AMBAS convenções (mediaUrl e audio/sticker/etc)
const mediaUrl = content.mediaUrl || content.audio || content.sticker 
  || content.image || content.video || content.document || "";

if (item.message_type === "text") {
  // ... igual
} else if (item.message_type === "audio") {
  // Endpoint específico para áudio nativo (PTT)
  if (!mediaUrl || typeof mediaUrl !== "string") {
    throw new Error(`invalid_audio_url: ${JSON.stringify(content)}`);
  }
  const r = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${encoded}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: item.group_jid, audio: mediaUrl, mentionsEveryOne }),
  });
  if (!r.ok) throw new Error(await r.text());
} else {
  // Outras mídias — validar URL antes
  if (!mediaUrl || typeof mediaUrl !== "string") {
    throw new Error(`invalid_media_url: ${JSON.stringify(content)}`);
  }
  const r = await fetch(`${baseUrl}/message/sendMedia/${encoded}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      number: item.group_jid,
      mediatype: item.message_type,
      media: mediaUrl,
      caption: content.caption || "",
      fileName: content.fileName || "",
      mentionsEveryOne,
    }),
  });
  if (!r.ok) throw new Error(await r.text());
}
```

### Fix 2 — Form: data obrigatória em "única"
`src/components/grupos/GroupScheduledMessageForm.tsx`

No `handleSubmit` (linha 171), validar antes de prosseguir:
```typescript
if (scheduleType === "once" && !scheduledAt) {
  toast({ title: "Data obrigatória", description: "Selecione a data do envio.", variant: "destructive" });
  return;
}
```
Importar `useToast` no topo. Marcar o Label "Data" com `*` visualmente.

### Fix 3 — Waveform plausível
`src/components/grupos/WhatsAppPreview.tsx` linha 76:
```typescript
const WAVEFORM_HEIGHTS = [
  35, 60, 45, 80, 55, 70, 40, 90, 65, 50, 75, 30, 85, 60, 45,
  70, 55, 80, 40, 65, 50, 75, 35, 90, 60, 45, 70, 55, 80, 30,
];
```
Padrão fixo que parece waveform real do WhatsApp, todos valores entre 30-90%.

## Reprocessar mensagens travadas + redeploy
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend

docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
UPDATE group_message_queue
SET status='pending', error_message=NULL, started_at=NULL, completed_at=NULL
WHERE message_type='audio' AND status='failed'
  AND created_at > now() - interval '24 hours';"
```

## Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/groups-api.ts` | Dispatch de áudio via `sendWhatsAppAudio` + resolver `content.audio`/`mediaUrl` |
| `src/components/grupos/GroupScheduledMessageForm.tsx` | Validar data obrigatória em "única" |
| `src/components/grupos/WhatsAppPreview.tsx` | Waveform com valores positivos plausíveis |

