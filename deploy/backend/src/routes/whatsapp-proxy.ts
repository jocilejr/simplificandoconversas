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

    const supabase = getServiceClient();

    const body = req.body;
    const { action, ...params } = body;

    if (!action) return res.status(400).json({ error: "action required" });

    let instanceName = params.instanceName;
    if (!instanceName) {
      const { data: activeInst } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .single();
      instanceName = activeInst?.instance_name;
    }

    const serviceClient = getServiceClient();
    let result: any;

    switch (action) {
      case "fetch-instances": {
        result = await evolutionRequest("/instance/fetchInstances", "GET");
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
          await serviceClient.from("whatsapp_instances").upsert(
            { user_id: userId, instance_name: customName, status: "close", is_active: false },
            { onConflict: "user_id,instance_name" }
          );
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
        
        // Try Evolution delete, but don't fail if instance doesn't exist there
        try {
          await evolutionRequest(`/instance/delete/${encodeURIComponent(delInstName)}`, "DELETE");
          console.log(`[delete-instance] Evolution delete OK for ${delInstName}`);
        } catch (e: any) {
          console.log(`[delete-instance] Evolution delete failed (may not exist): ${e.message}`);
        }
        
        // Always clean up local DB
        await serviceClient.from("whatsapp_instances").delete().eq("user_id", userId).eq("instance_name", delInstName);
        console.log(`[delete-instance] DB cleanup done for ${delInstName}`);
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

        result = await evolutionRequest(`/message/${endpoint}/${encodeURIComponent(instanceName)}`, "POST", payload);

        if (result?.key) {
          const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;
          const { data: conv } = await serviceClient.from("conversations").upsert(
            { user_id: userId, remote_jid: jid, last_message: message || `[${messageType}]`, last_message_at: new Date().toISOString(), instance_name: instanceName },
            { onConflict: "user_id,remote_jid,instance_name" }
          ).select("id").single();

          if (conv) {
            await serviceClient.from("messages").insert({
              conversation_id: conv.id, user_id: userId, remote_jid: jid, content: message,
              message_type: messageType, direction: "outbound", status: "sent",
              external_id: result?.key?.id || null, media_url: mediaUrl || null,
            });
          }
        }
        break;
      }

      case "fetch-chats": {
        result = await evolutionRequest(`/chat/findChats/${encodeURIComponent(instanceName)}`, "POST", {});
        break;
      }

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

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
