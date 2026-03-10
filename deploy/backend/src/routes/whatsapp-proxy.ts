import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import crypto from "crypto";

const router = Router();

const EVOLUTION_URL = process.env.EVOLUTION_URL || "http://evolution:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

async function evolutionRequest(path: string, method: string = "POST", body?: any) {
  const resp = await fetch(`${EVOLUTION_URL}${path}`, {
    method,
    headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return resp.json() as Promise<any>;
}

async function downloadAndUploadMedia(
  storageClient: any, instanceName: string, messageData: any, messageType: string, userId: string
): Promise<string | null> {
  try {
    let base64 = messageData.message?.base64;
    const mediaMessage = messageData.message?.imageMessage || messageData.message?.videoMessage || messageData.message?.audioMessage || messageData.message?.documentMessage;

    if (!base64 && mediaMessage) {
      try {
        const result = await evolutionRequest(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`, "POST", { message: messageData, convertToMp4: messageType === "audio" });
        base64 = result?.base64;
      } catch (e: any) {
        console.error("getBase64 error:", e.message);
      }
    }

    if (!base64) return null;

    const mimetype = mediaMessage?.mimetype || (messageType === "image" ? "image/jpeg" : messageType === "video" ? "video/mp4" : "audio/ogg");
    const extMap: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a" };
    const ext = extMap[mimetype] || mimetype.split("/")[1] || "bin";
    const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;

    const buffer = Buffer.from(base64, "base64");

    const { error: uploadError } = await storageClient.storage.from("chatbot-media").upload(fileName, buffer, { contentType: mimetype, upsert: false });
    if (uploadError) { console.error("Upload error:", uploadError.message); return null; }

    const { data: publicUrl } = storageClient.storage.from("chatbot-media").getPublicUrl(fileName);
    return publicUrl?.publicUrl || null;
  } catch (e: any) {
    console.error("Media download/upload error:", e.message);
    return null;
  }
}

router.post("/", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"] as string;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    const gotrueUrl = process.env.GOTRUE_URL || "http://gotrue:9999";
    const userResp = await fetch(`${gotrueUrl}/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!userResp.ok) return res.status(401).json({ error: "Unauthorized" });
    const userData: any = await userResp.json();
    const userId = userData.id;
    console.log(`[whatsapp-proxy] Authenticated userId: ${userId}`);

    const supabase = getServiceClient();

    const body = req.body;
    const { action, ...params } = body;

    if (!action) return res.status(400).json({ error: "action required" });

    let instanceName = params.instanceName;
    if (!instanceName) {
      const { data: activeInst, error: activeInstErr } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (activeInstErr) console.error("[whatsapp-proxy] Active instance query error:", activeInstErr);
      else console.log("[whatsapp-proxy] Active instance:", activeInst?.instance_name || "none");
      instanceName = activeInst?.instance_name;
    }

    const serviceClient = getServiceClient();
    let result: any;

    switch (action) {
      case "fetch-instances": {
        const instances = await evolutionRequest("/instance/fetchInstances", "GET");
        const list = Array.isArray(instances) ? instances : [];
        console.log(`[fetch-instances] Evolution returned ${list.length} instances`);

        // Auto-populate whatsapp_instances table (without overwriting is_active)
        for (const inst of list) {
          const name = inst.name || inst.instanceName || "unknown";
          const status = inst.connectionStatus || "close";
          if (name === "unknown") continue;
          // Check if instance already exists
          const { data: existing } = await serviceClient.from("whatsapp_instances")
            .select("id").eq("user_id", userId).eq("instance_name", name).maybeSingle();
          if (existing) {
            // Only update status, never touch is_active
            const { error: updateErr } = await serviceClient.from("whatsapp_instances")
              .update({ status }).eq("id", existing.id);
            if (updateErr) console.error(`[fetch-instances] DB update error for ${name}:`, updateErr);
            else console.log(`[fetch-instances] Updated instance status: ${name}`);
          } else {
            const { error: insertErr } = await serviceClient.from("whatsapp_instances")
              .insert({ user_id: userId, instance_name: name, status, is_active: false });
            if (insertErr) console.error(`[fetch-instances] DB insert error for ${name}:`, insertErr);
            else console.log(`[fetch-instances] Inserted new instance: ${name}`);
          }
        }

        // Ensure at least one instance is active
        const { data: activeCheck, error: activeCheckErr } = await serviceClient
          .from("whatsapp_instances")
          .select("id").eq("user_id", userId).eq("is_active", true).limit(1);
        if (activeCheckErr) console.error("[fetch-instances] Active check error:", activeCheckErr);
        else console.log(`[fetch-instances] Active instances found: ${activeCheck?.length || 0}`);
        
        if ((!activeCheck || activeCheck.length === 0) && list.length > 0) {
          const firstName = list[0].name || list[0].instanceName;
          if (firstName) {
            const { error: updateErr } = await serviceClient.from("whatsapp_instances")
              .update({ is_active: true })
              .eq("user_id", userId).eq("instance_name", firstName);
            if (updateErr) console.error(`[fetch-instances] Set active error for ${firstName}:`, updateErr);
            else console.log(`[fetch-instances] Set ${firstName} as active`);
          }
        }

        result = instances;
        break;
      }

      case "create-instance": {
        const customName = params.instanceName || `sc-${Date.now().toString(36)}`;
        console.log("[create-instance] Creating instance:", customName);
        const createResult = await evolutionRequest("/instance/create", "POST", {
          instanceName: customName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        });
        console.log("[create-instance] Create result:", JSON.stringify(createResult));
        if (createResult?.instance) {
          const { error: upsertErr } = await serviceClient.from("whatsapp_instances").upsert(
            { user_id: userId, instance_name: customName, status: "close", is_active: false },
            { onConflict: "user_id,instance_name" }
          );
          if (upsertErr) console.error("[create-instance] DB upsert error:", upsertErr);
          else console.log("[create-instance] DB upsert OK");
        }
        result = { ...createResult, instanceName: customName };
        break;
      }

      case "get-qrcode": {
        const { instanceName: qrInstName } = params;
        if (!qrInstName) return res.status(400).json({ error: "instanceName required" });
        result = await evolutionRequest(`/instance/connect/${encodeURIComponent(qrInstName)}`, "GET");
        break;
      }

      case "logout-instance": {
        const { instanceName: logoutInstName } = params;
        if (!logoutInstName) return res.status(400).json({ error: "instanceName required" });
        console.log("[logout-instance] Logging out:", logoutInstName);
        await evolutionRequest(`/instance/logout/${encodeURIComponent(logoutInstName)}`, "DELETE");
        await new Promise(resolve => setTimeout(resolve, 1500));
        result = await evolutionRequest(`/instance/connect/${encodeURIComponent(logoutInstName)}`, "GET");
        console.log("[logout-instance] New QR result:", JSON.stringify(result));
        break;
      }

      case "connect-instance": {
        const { instanceName: connInstName } = params;
        if (!connInstName) return res.status(400).json({ error: "instanceName required" });
        result = await evolutionRequest(`/instance/connect/${encodeURIComponent(connInstName)}`, "GET");
        break;
      }

      case "delete-instance": {
        const { instanceName: delInstName } = params;
        if (!delInstName) return res.status(400).json({ error: "instanceName required" });
        console.log(`[delete-instance] Deleting: ${delInstName} for user ${userId}`);
        
        try {
          await evolutionRequest(`/instance/delete/${encodeURIComponent(delInstName)}`, "DELETE");
          console.log(`[delete-instance] Evolution delete OK for ${delInstName}`);
        } catch (e: any) {
          console.log(`[delete-instance] Evolution delete failed: ${e.message}`);
        }
        
        const { data: deleted, error: deleteErr } = await serviceClient
          .from("whatsapp_instances").delete()
          .eq("instance_name", delInstName)
          .select("id");
        if (deleteErr) console.error(`[delete-instance] DB delete error:`, deleteErr);
        else console.log(`[delete-instance] DB rows deleted: ${deleted?.length || 0}`);
        result = { ok: true, deleted: delInstName };
        break;
      }

      case "set-proxy": {
        result = { ok: true, message: "Proxy not applicable with Evolution API" };
        break;
      }

      case "set-webhook": {
        result = { ok: true, message: "Webhook auto-configured via Evolution global webhook" };
        break;
      }

      case "sync-webhooks": {
        result = { synced: 0, message: "Webhooks auto-configured in Evolution API" };
        break;
      }

      case "test-connection": {
        result = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`, "GET");
        break;
      }

      case "send-message": {
        const { remoteJid, message, messageType = "text", mediaUrl } = params;
        let endpoint = "sendText";
        let payload: Record<string, unknown> = { number: remoteJid, text: message };

        if (messageType === "image") {
          endpoint = "sendMedia";
          payload = { number: remoteJid, mediatype: "image", media: mediaUrl, caption: message || "" };
        } else if (messageType === "audio") {
          endpoint = "sendWhatsAppAudio";
          payload = { number: remoteJid, audio: mediaUrl };
        } else if (messageType === "video") {
          endpoint = "sendMedia";
          payload = { number: remoteJid, mediatype: "video", media: mediaUrl, caption: message || "" };
        }

        console.log(`[send-message] Sending ${messageType} to ${remoteJid} via ${instanceName}`);
        result = await evolutionRequest(`/message/${endpoint}/${encodeURIComponent(instanceName)}`, "POST", payload);
        console.log(`[send-message] Evolution result:`, JSON.stringify(result)?.substring(0, 300));

        if (result?.key) {
          const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;
          const { data: conv, error: convErr } = await serviceClient.from("conversations").upsert(
            { user_id: userId, remote_jid: jid, last_message: message || `[${messageType}]`, last_message_at: new Date().toISOString(), instance_name: instanceName },
            { onConflict: "user_id,remote_jid,instance_name" }
          ).select("id").single();
          if (convErr) console.error("[send-message] Conv upsert error:", convErr);
          else console.log("[send-message] Conv upserted:", conv?.id);

          if (conv) {
            const { error: msgErr } = await serviceClient.from("messages").insert({
              conversation_id: conv.id, user_id: userId, remote_jid: jid, content: message,
              message_type: messageType, direction: "outbound", status: "sent",
              external_id: result?.key?.id || null, media_url: mediaUrl || null,
            });
            if (msgErr) console.error("[send-message] Message insert error:", msgErr);
            else console.log("[send-message] Message inserted OK");
          }
        }
        break;
      }

      case "fetch-chats": {
        result = await evolutionRequest(`/chat/findChats/${encodeURIComponent(instanceName)}`, "POST", {});
        break;
      }

      case "sync-chats": {
        const allEvolutionInstances = await evolutionRequest("/instance/fetchInstances", "GET");
        const evolutionList = Array.isArray(allEvolutionInstances) ? allEvolutionInstances : [];
        
        const instancesToSync = evolutionList.map((i: any) => 
          i.name || i.instanceName || i.instance?.instanceName || "unknown"
        ).filter((n: string) => n !== "unknown");
        console.log(`[sync-chats] Instances from Evolution API: ${JSON.stringify(instancesToSync)}`);

        // Sync instances WITHOUT overwriting is_active
        for (const instName of instancesToSync) {
          const { data: existing } = await serviceClient.from("whatsapp_instances")
            .select("id").eq("user_id", userId).eq("instance_name", instName).maybeSingle();
          if (!existing) {
            const { error: insertErr } = await serviceClient.from("whatsapp_instances")
              .insert({ user_id: userId, instance_name: instName, status: "close", is_active: false });
            if (insertErr) console.error(`[sync-chats] Instance insert error for ${instName}:`, insertErr);
          }
        }

        let totalSynced = 0;
        let totalMessagesSynced = 0;
        const instanceStatuses: any[] = [];

        for (const instName of instancesToSync) {
          const stateResult = await evolutionRequest(
            `/instance/connectionState/${encodeURIComponent(instName)}`, "GET"
          );
          const connectionState = stateResult?.instance?.state || "close";
          console.log(`[sync-chats] ${instName}: connectionState=${connectionState}`);
          const { error: statusErr } = await serviceClient.from("whatsapp_instances")
            .update({ status: connectionState })
            .eq("instance_name", instName)
            .eq("user_id", userId);
          if (statusErr) console.error(`[sync-chats] Status update error for ${instName}:`, statusErr);
          instanceStatuses.push({ instance: instName, connectionState });

          if (connectionState !== "open") continue;

          try {
            // Step 1: Use findChats to get all contacts
            const chatsResponse = await evolutionRequest(
              `/chat/findChats/${encodeURIComponent(instName)}`, "POST", {}
            );
            const chatList = Array.isArray(chatsResponse) ? chatsResponse : [];
            console.log(`[sync-chats] ${instName}: findChats returned ${chatList.length} chats`);
            // Helper: extract raw JID from chat object
            function extractJid(chat: any): string {
              return chat.remoteJid || chat.jid || chat.chatId || chat.owner || "";
            }

            // Filter: only real phone contacts (@s.whatsapp.net), no groups, no @lid, no broadcasts
            const individualChats = chatList.filter((chat: any) => {
              const jid = extractJid(chat);
              if (!jid) return false;
              return jid.includes("@s.whatsapp.net") && jid !== "status@broadcast";
            });
            console.log(`[sync-chats] ${instName}: ${individualChats.length} individual contacts after filtering`);

            for (const chat of individualChats) {
              const jid = extractJid(chat);
              if (!jid) continue;

              const contactName = chat.name || chat.pushName || chat.contact?.pushName || null;
              const lastMsgContent = chat.lastMessage?.message?.conversation
                || chat.lastMessage?.message?.extendedTextMessage?.text
                || chat.lastMessage?.message?.imageMessage?.caption
                || (chat.lastMessage ? "[media]" : null);
              const lastTs = chat.lastMessage?.messageTimestamp
                ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000).toISOString()
                : new Date().toISOString();

              // Upsert conversation
              const { data: convData, error: convErr } = await serviceClient.from("conversations").upsert({
                user_id: userId,
                remote_jid: jid,
                contact_name: contactName,
                instance_name: instName,
                last_message: lastMsgContent,
                last_message_at: lastTs,
              }, { onConflict: "user_id,remote_jid,instance_name" }).select("id").maybeSingle();
              if (convErr) console.error(`[sync-chats] Conv upsert error for ${jid}:`, convErr);
              else console.log(`[sync-chats] Conv upserted for ${jid}: ${convData?.id} (${contactName})`);
              totalSynced++;

              if (!convData) continue;

              // Step 2: Fetch all messages for this contact with pagination
              // Use rawJid for API query (Evolution needs the original format), but resolved jid for DB
              let page = 1;
              let contactMsgsSynced = 0;
              while (true) {
                const msgResponse = await evolutionRequest(
                  `/chat/findMessages/${encodeURIComponent(instName)}`, "POST",
                  { where: { key: { remoteJid: rawJid } }, page }
                );

                let messageList: any[] = [];
                if (msgResponse?.messages?.records) {
                  messageList = msgResponse.messages.records;
                } else if (Array.isArray(msgResponse?.messages)) {
                  messageList = msgResponse.messages;
                } else if (Array.isArray(msgResponse)) {
                  messageList = msgResponse;
                } else if (msgResponse?.data && Array.isArray(msgResponse.data)) {
                  messageList = msgResponse.data;
                }

                const totalPages = msgResponse?.messages?.pages || 1;
                console.log(`[sync-chats] ${instName}/${jid}: page ${page}/${totalPages}, ${messageList.length} messages`);

                for (const msg of messageList) {
                  const key = msg.key || {};
                  const externalId = key.id;
                  if (!externalId) continue;

                  // Dedup check
                  const { data: existing } = await serviceClient.from("messages")
                    .select("id").eq("external_id", externalId).maybeSingle();
                  if (existing) continue;

                  const isFromMe = key.fromMe === true;
                  const msgContent = msg.message?.conversation
                    || msg.message?.extendedTextMessage?.text
                    || msg.message?.imageMessage?.caption
                    || msg.message?.videoMessage?.caption
                    || null;

                  let msgType = "text";
                  if (msg.message?.imageMessage) msgType = "image";
                  else if (msg.message?.videoMessage) msgType = "video";
                  else if (msg.message?.audioMessage) msgType = "audio";
                  else if (msg.message?.documentMessage) msgType = "document";
                  else if (msg.message?.stickerMessage) msgType = "sticker";

                  const timestamp = msg.messageTimestamp
                    ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
                    : new Date().toISOString();

                  const { error: insertErr } = await serviceClient.from("messages").insert({
                    conversation_id: convData.id,
                    user_id: userId,
                    remote_jid: jid,
                    content: msgContent || (msgType !== "text" ? `[${msgType}]` : null),
                    message_type: msgType,
                    direction: isFromMe ? "outbound" : "inbound",
                    status: "delivered",
                    external_id: externalId,
                    created_at: timestamp,
                  });
                  if (insertErr) console.error(`[sync-chats] Message insert error for ${externalId}:`, insertErr);
                  else contactMsgsSynced++;
                }

                if (page >= totalPages) break;
                page++;
              }
              totalMessagesSynced += contactMsgsSynced;
              console.log(`[sync-chats] ${jid}: ${contactMsgsSynced} new messages synced`);
            }
          } catch (e: any) {
            console.error(`[sync-chats] Error syncing ${instName}:`, e.message);
          }
        }

        console.log(`[sync-chats] Total chats synced: ${totalSynced}, messages synced: ${totalMessagesSynced}`);
        result = { synced: totalSynced, messagesSynced: totalMessagesSynced, instanceStatuses };
        break;
      }

      case "fetch-profile-picture": {
        const { remoteJid: picJid } = params;
        if (!picJid) return res.status(400).json({ error: "remoteJid required" });
        result = await evolutionRequest(`/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`, "POST", { number: picJid.split("@")[0] });
        break;
      }

      case "fetch-profile-pictures": {
        const { remoteJids: jids } = params;
        if (!jids || !Array.isArray(jids)) return res.status(400).json({ error: "remoteJids required" });
        const photos: Record<string, string> = {};
        const batches = [];
        for (let i = 0; i < jids.length; i += 10) batches.push(jids.slice(i, i + 10));
        for (const batch of batches) {
          await Promise.allSettled(batch.map(async (jid: string) => {
            try {
              const d = await evolutionRequest(`/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`, "POST", { number: jid.split("@")[0] });
              const url = d?.profilePictureUrl;
              if (url) photos[jid] = url;
            } catch {}
          }));
        }
        result = photos;
        break;
      }

      case "fetch-contact-names": {
        result = await evolutionRequest(`/chat/findContacts/${encodeURIComponent(instanceName)}`, "POST", {});
        break;
      }

      case "fetch-messages": {
        const { remoteJid } = params;
        if (!remoteJid) return res.status(400).json({ error: "remoteJid required" });
        result = { imported: 0, info: "Messages arrive via webhook" };
        break;
      }

      case "debug-findchats": {
        if (!instanceName) return res.status(400).json({ error: "No active instance" });
        const rawChats = await evolutionRequest(`/chat/findChats/${encodeURIComponent(instanceName)}`, "POST", {});
        const rawList = Array.isArray(rawChats) ? rawChats : [];
        // Return first 5 chats with truncated data for debugging
        result = rawList.slice(0, 5).map((c: any, i: number) => ({
          index: i,
          keys: Object.keys(c),
          dump: JSON.stringify(c).substring(0, 600),
        }));
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.json(result);
  } catch (err: any) {
    console.error("[whatsapp-proxy] Unhandled error:", err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
