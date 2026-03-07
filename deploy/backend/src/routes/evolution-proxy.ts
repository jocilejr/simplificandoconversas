import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import crypto from "crypto";

const router = Router();

const BAILEYS_URL = process.env.BAILEYS_URL || "http://baileys:8084";
const BAILEYS_API_KEY = process.env.BAILEYS_API_KEY || "baileys-local-key";

async function baileysRequest(path: string, method: string = "POST", body?: any) {
  const resp = await fetch(`${BAILEYS_URL}${path}`, {
    method,
    headers: { apikey: BAILEYS_API_KEY, "Content-Type": "application/json" },
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
        const result = await baileysRequest(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`, "POST", { message: messageData, convertToMp4: messageType === "audio" });
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

    // Verify JWT via GoTrue
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

    // Get instance name from body or from active instance in DB
    let evolution_instance_name = params.instanceName;
    if (!evolution_instance_name) {
      const { data: activeInst } = await supabase
        .from("evolution_instances")
        .select("instance_name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .single();
      evolution_instance_name = activeInst?.instance_name;
    }

    const serviceClient = getServiceClient();
    let result: any;

    switch (action) {
      case "fetch-instances": {
        result = await baileysRequest("/instance/fetchInstances", "GET");
        break;
      }

      case "create-instance": {
        const instanceName = `sc-${Date.now().toString(36)}`;
        const createResult = await baileysRequest("/instance/create", "POST", { instanceName });
        await serviceClient.from("evolution_instances").upsert({ user_id: userId, instance_name: instanceName, status: "close", is_active: false }, { onConflict: "user_id,instance_name" });
        result = { ...createResult, instanceName };
        break;
      }

      case "connect-instance": {
        const { instanceName: connInstName } = params;
        if (!connInstName) return res.status(400).json({ error: "instanceName required" });
        result = await baileysRequest(`/instance/connect/${encodeURIComponent(connInstName)}`, "POST");
        break;
      }

      case "delete-instance": {
        const { instanceName: delInstName } = params;
        if (!delInstName) return res.status(400).json({ error: "instanceName required" });
        result = await baileysRequest(`/instance/delete/${encodeURIComponent(delInstName)}`, "DELETE");
        await serviceClient.from("evolution_instances").delete().eq("user_id", userId).eq("instance_name", delInstName);
        break;
      }

      case "set-proxy": {
        // No-op for Baileys — proxy is not supported
        result = { ok: true, message: "Proxy not applicable with Baileys" };
        break;
      }

      case "set-webhook": {
        // No-op — Baileys auto-forwards via webhook
        result = { ok: true, message: "Webhook auto-configured" };
        break;
      }

      case "sync-webhooks": {
        result = { synced: 0, message: "Webhooks auto-configured in Baileys" };
        break;
      }

      case "test-connection": {
        result = await baileysRequest(`/instance/connectionState/${encodeURIComponent(evolution_instance_name)}`, "GET");
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

        result = await baileysRequest(`/message/${endpoint}/${encodeURIComponent(evolution_instance_name)}`, "POST", payload);

        if (result?.key) {
          const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;
          const { data: conv } = await serviceClient.from("conversations").upsert(
            { user_id: userId, remote_jid: jid, last_message: message || `[${messageType}]`, last_message_at: new Date().toISOString(), instance_name: evolution_instance_name },
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
        result = await baileysRequest(`/chat/findChats/${encodeURIComponent(evolution_instance_name)}`, "POST", {});
        break;
      }

      case "sync-chats": {
        // Simplified sync for Baileys — conversations come via webhook
        const { data: userInstances } = await serviceClient.from("evolution_instances").select("instance_name").eq("user_id", userId);
        const instancesToSync = userInstances?.map((i: any) => i.instance_name) || [];
        if (evolution_instance_name && !instancesToSync.includes(evolution_instance_name)) {
          instancesToSync.push(evolution_instance_name);
        }

        const instanceStatuses: any[] = [];
        for (const instName of instancesToSync) {
          const stateResult = await baileysRequest(`/instance/connectionState/${encodeURIComponent(instName)}`, "GET");
          const connectionState = stateResult?.instance?.state || "close";
          await serviceClient.from("evolution_instances").update({ status: connectionState }).eq("user_id", userId).eq("instance_name", instName);
          instanceStatuses.push({ instance: instName, connectionState });
        }

        result = { synced: 0, info: "Conversas chegam via webhook em tempo real", instanceStatuses };
        break;
      }

      case "fetch-profile-picture": {
        const { remoteJid: picJid } = params;
        if (!picJid) return res.status(400).json({ error: "remoteJid required" });
        result = await baileysRequest(`/chat/fetchProfilePictureUrl/${encodeURIComponent(evolution_instance_name)}`, "POST", { number: picJid.split("@")[0] });
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
              const d = await baileysRequest(`/chat/fetchProfilePictureUrl/${encodeURIComponent(evolution_instance_name)}`, "POST", { number: jid.split("@")[0] });
              const url = d?.profilePictureUrl;
              if (url) photos[jid] = url;
            } catch {}
          }));
        }
        result = photos;
        break;
      }

      case "fetch-contact-names": {
        result = await baileysRequest(`/chat/findContacts/${encodeURIComponent(evolution_instance_name)}`, "POST", {});
        break;
      }

      case "fetch-messages": {
        const { remoteJid, count = 50 } = params;
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
