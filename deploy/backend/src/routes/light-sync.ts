import { getServiceClient } from "../lib/supabase";

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

/**
 * Light sync: calls findChats for each connected instance and upserts conversations
 * without fetching individual messages. Runs periodically to catch undecrypted/pending chats.
 */
export async function lightSync() {
  const supabase = getServiceClient();

  // Get all instances with their user_ids
  const { data: instances, error: instErr } = await supabase
    .from("whatsapp_instances")
    .select("instance_name, user_id")
    .eq("is_active", true);

  if (instErr || !instances || instances.length === 0) return;

  for (const inst of instances) {
    try {
      // Check connection state first
      const stateResult = await evolutionRequest(
        `/instance/connectionState/${encodeURIComponent(inst.instance_name)}`, "GET"
      );
      const state = stateResult?.instance?.state || "close";
      if (state !== "open") continue;

      const chatsResponse = await evolutionRequest(
        `/chat/findChats/${encodeURIComponent(inst.instance_name)}`, "POST", {}
      );
      const chatList = Array.isArray(chatsResponse) ? chatsResponse : [];

      const individualChats = chatList.filter((chat: any) => {
        const jid = chat.remoteJid || chat.jid || chat.chatId || chat.owner || "";
        if (!jid) return false;
        if (jid.includes("@g.us") || jid === "status@broadcast") return false;
        return jid.includes("@s.whatsapp.net") || jid.includes("@lid");
      });

      let created = 0;
      for (const chat of individualChats) {
        const rawJid = chat.remoteJid || chat.jid || chat.chatId || chat.owner || "";
        if (!rawJid) continue;

        const isLid = rawJid.includes("@lid");
        const phoneNumber = rawJid.includes("@s.whatsapp.net") ? rawJid.split("@")[0] : null;
        const contactName = chat.name || chat.pushName || chat.contact?.pushName || null;

        // Check if conversation already exists
        let exists = false;
        if (isLid) {
          const { data } = await supabase.from("conversations")
            .select("id").eq("user_id", inst.user_id).eq("lid", rawJid).eq("instance_name", inst.instance_name).limit(1).maybeSingle();
          if (data) exists = true;
        } else {
          const { data } = await supabase.from("conversations")
            .select("id").eq("user_id", inst.user_id).eq("remote_jid", rawJid).eq("instance_name", inst.instance_name).limit(1).maybeSingle();
          if (data) exists = true;
        }

        if (exists) continue;

        // New conversation — extract last message info
        let lastMsgContent: string | null = null;
        if (chat.lastMessage) {
          const msg = chat.lastMessage.message;
          if (!msg) {
            lastMsgContent = "Não foi possível visualizar a mensagem, abra seu smartphone para sincronizar";
          } else {
            lastMsgContent = msg.conversation
              || msg.extendedTextMessage?.text
              || msg.imageMessage?.caption
              || msg.videoMessage?.caption
              || (Object.keys(msg).filter((k: string) => k !== "messageContextInfo").length > 0 ? "[media]" : "Não foi possível visualizar a mensagem, abra seu smartphone para sincronizar");
          }
        }
        const lastTs = chat.lastMessage?.messageTimestamp
          ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();

        const upsertPayload: Record<string, unknown> = {
          user_id: inst.user_id,
          remote_jid: rawJid,
          contact_name: contactName,
          instance_name: inst.instance_name,
          last_message: lastMsgContent,
          last_message_at: lastTs,
          phone_number: phoneNumber,
        };
        if (isLid) upsertPayload.lid = rawJid;

        const { error } = await supabase.from("conversations").upsert(
          upsertPayload,
          { onConflict: "user_id,remote_jid,instance_name" }
        );
        if (error) {
          console.error(`[light-sync] Conv error for ${rawJid}:`, error.message);
        } else {
          created++;
        }
      }

      if (created > 0) {
        console.log(`[light-sync] ${inst.instance_name}: ${created} new conversations created`);
      }
    } catch (e: any) {
      console.error(`[light-sync] Error for ${inst.instance_name}:`, e.message);
    }
  }
}
