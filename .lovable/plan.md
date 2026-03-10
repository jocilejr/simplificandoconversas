

## Problema

O build falha porque o webhook.ts tem variáveis usadas mas nunca declaradas dentro do handler `router.post`. Na edição anterior, o bloco de resolução `@lid` foi expandido mas as declarações de variáveis essenciais foram removidas acidentalmente.

Variáveis faltando entre a linha 199 e 201:
- `supabase` (service client)
- `userId` (do whatsapp_instances)
- `messageType`, `messageContent`, `externalId`, `lastMessagePreview` (extraídos do payload)

## Correção

**Arquivo: `deploy/backend/src/routes/webhook.ts`**

Inserir entre o fim do bloco de resolução `@lid` (linha 199) e o `if (fromMe && event === "send.message")` (linha 201) o bloco de declaração de variáveis:

```typescript
    // Skip group messages
    if (remoteJid && remoteJid.includes("@g.us")) {
      return res.json({ ok: true, skipped: "group" });
    }

    // Get supabase client and user info
    const supabase = getServiceClient();

    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("user_id")
      .eq("instance_name", instance)
      .limit(1)
      .single();

    if (!inst) {
      console.error("No instance found for:", instance);
      return res.status(404).json({ error: "Instance not found" });
    }

    const userId = inst.user_id;

    // Extract message content
    const message = data.message || {};
    const messageContent = message.conversation
      || message.extendedTextMessage?.text
      || message.imageMessage?.caption
      || message.videoMessage?.caption
      || message.documentMessage?.caption
      || "";
    const externalId = data.key?.id || data.messageId || null;

    // Determine message type
    let messageType = "text";
    if (message.imageMessage) messageType = "image";
    else if (message.videoMessage) messageType = "video";
    else if (message.audioMessage) messageType = "audio";
    else if (message.documentMessage) messageType = "document";
    else if (message.stickerMessage) messageType = "sticker";

    const lastMessagePreview = truncate(messageContent || `[${messageType}]`, 100);
```

Nenhuma outra alteração necessária -- o resto do código já usa essas variáveis corretamente.

