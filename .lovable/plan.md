

## Plano: Importar conversas antigas no sync-chats

### Problema
O `sync-chats` atual apenas verifica o status das instâncias e retorna `"Conversas chegam via webhook em tempo real"` sem importar nenhum chat. Conversas antigas do WhatsApp nunca entram no banco.

### Alteração

**`deploy/backend/src/routes/whatsapp-proxy.ts`** — reescrever o case `sync-chats` (linhas 222-238):

```typescript
case "sync-chats": {
  const { data: userInstances } = await serviceClient
    .from("whatsapp_instances").select("instance_name").eq("user_id", userId);
  const instancesToSync = userInstances?.map((i: any) => i.instance_name) || [];

  let totalSynced = 0;
  const instanceStatuses: any[] = [];

  for (const instName of instancesToSync) {
    const stateResult = await evolutionRequest(
      `/instance/connectionState/${encodeURIComponent(instName)}`, "GET"
    );
    const connectionState = stateResult?.instance?.state || "close";
    await serviceClient.from("whatsapp_instances")
      .update({ status: connectionState })
      .eq("user_id", userId).eq("instance_name", instName);
    instanceStatuses.push({ instance: instName, connectionState });

    if (connectionState !== "open") continue;

    // Fetch real chats from Evolution API
    try {
      const chats = await evolutionRequest(
        `/chat/findChats/${encodeURIComponent(instName)}`, "POST", {}
      );
      if (!Array.isArray(chats)) continue;

      for (const chat of chats) {
        const remoteJid = chat.id || chat.remoteJid;
        if (!remoteJid || remoteJid.includes("@g.us") || remoteJid === "status@broadcast") continue;

        await serviceClient.from("conversations").upsert({
          user_id: userId,
          remote_jid: remoteJid,
          contact_name: chat.name || chat.pushName || null,
          instance_name: instName,
          last_message_at: chat.lastMsgTimestamp
            ? new Date(chat.lastMsgTimestamp * 1000).toISOString()
            : new Date().toISOString(),
        }, { onConflict: "user_id,remote_jid,instance_name" });
        totalSynced++;
      }
    } catch (e: any) {
      console.error(`[sync-chats] Error fetching chats for ${instName}:`, e.message);
    }
  }

  result = { synced: totalSynced, instanceStatuses };
  break;
}
```

O tempo real já funciona via webhook (`messages.upsert` / `send.message`) -- nenhuma alteração necessária para novas mensagens.

### Deploy na VPS

```bash
cd ~/simplificandoconversas
git pull origin main
cd deploy
docker compose up -d --build backend
```

Depois clicar no botao de sincronizar (refresh) na tela de Conversas.

