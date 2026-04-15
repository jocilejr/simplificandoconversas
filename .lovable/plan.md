

# Plano: Corrigir monitoramento de entradas/saídas de grupos

## Causa raiz
A Evolution API envia TODOS os webhooks (mensagens, conexão, **grupos**) para a URL global única: `http://backend:3001/api/webhook`. O endpoint `/api/groups/webhook/events` é uma rota separada que **nunca recebe tráfego** porque a Evolution não sabe que ela existe. A tabela `group_participant_events` está vazia por isso.

## Solução
Interceptar eventos de grupo diretamente no webhook principal (`deploy/backend/src/routes/webhook.ts`), redirecionando para a lógica do `groups-webhook` antes de processar mensagens normais.

### Alteração em `deploy/backend/src/routes/webhook.ts`

No início do handler principal (antes da lógica de mensagens), adicionar detecção de eventos de grupo:

```typescript
// No topo do arquivo, importar o handler
import groupsWebhookRouter from "./groups-webhook";

// Ou, mais simples — inline no webhook principal:
const event = body.event || "";
if (event.includes("group") || event.includes("participant")) {
  // Forward para a lógica de grupos
  // Reusar a lógica do groups-webhook.ts inline
  try {
    const data = body.data || body;
    const instanceName = body.instance || body.instanceName || "";
    const groupJid = data.groupJid || data.id || "";
    const participants = data.participants || [];
    const action = data.action || event;

    if (groupJid && participants.length > 0) {
      const sb = getServiceClient();
      const { data: inst } = await sb
        .from("whatsapp_instances")
        .select("workspace_id, user_id")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (inst) {
        const { data: sg } = await sb
          .from("group_selected")
          .select("group_name, member_count")
          .eq("workspace_id", inst.workspace_id)
          .eq("group_jid", groupJid)
          .maybeSingle();

        const rows = participants.map((p: string) => ({
          workspace_id: inst.workspace_id,
          user_id: inst.user_id,
          instance_name: instanceName,
          group_jid: groupJid,
          group_name: sg?.group_name || "",
          participant_jid: p,
          action,
        }));

        await sb.from("group_participant_events").insert(rows);

        // Atualizar member_count no group_selected
        if (sg) {
          const increment = action === "add" ? participants.length 
                          : action === "remove" ? -participants.length : 0;
          if (increment !== 0) {
            const newCount = Math.max(0, (sg.member_count || 0) + increment);
            await sb.from("group_selected")
              .update({ member_count: newCount })
              .eq("workspace_id", inst.workspace_id)
              .eq("group_jid", groupJid);
          }
        }

        // Atualizar smart links JSONB
        // (mesma lógica do groups-webhook.ts)

        console.log(`[webhook] group event: ${action} ${participants.length} in ${groupJid}`);
      }
    }
  } catch (e: any) {
    console.error("[webhook] group event error:", e.message);
  }
  return res.json({ ok: true });
}
```

## Arquivo modificado
- `deploy/backend/src/routes/webhook.ts` — adicionar interceptação de eventos de grupo no handler principal

## Após deploy
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

## Validação
Após rebuild, rodar na VPS:
```bash
docker compose logs -f backend 2>&1 | grep "group event"
```
Quando alguém entrar/sair de um grupo, deve aparecer o log e a tabela `group_participant_events` vai popular.

