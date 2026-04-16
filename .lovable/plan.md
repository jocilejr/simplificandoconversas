

# Plano: Forward de eventos de grupo no webhook principal

## Problema
A Evolution API envia todos os webhooks para `/api/webhook`. O código atual (linha 186-190 de `webhook.ts`) ignora eventos de grupo em vez de encaminhá-los ao handler dedicado `/api/groups/webhook/events`.

## Mudança

### `deploy/backend/src/routes/webhook.ts` (linhas 186-190)

Substituir o bloco que ignora por um forward interno via `fetch`:

```typescript
if (event && (event.includes("group") || event.includes("participant"))) {
  const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
  try {
    const fwd = await fetch(`${baseUrl}/api/groups/webhook/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const result = await fwd.json();
    console.log(`[webhook] forwarded group event: ${event}`, result);
    return res.json(result);
  } catch (e: any) {
    console.error("[webhook] failed to forward group event:", e.message);
    return res.status(500).json({ error: "forward failed" });
  }
}
```

## Arquivo modificado

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/webhook.ts` | Forward interno em vez de ignorar |

## Comando VPS após deploy

```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

## Resultado esperado

- Eventos de grupo voltam a ser salvos em `group_participant_events`
- Contadores "Entraram/Saíram" passam a refletir dados reais
- Nenhuma alteração necessária na Evolution API

