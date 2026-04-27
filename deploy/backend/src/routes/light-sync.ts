import { getServiceClient } from "../lib/supabase";
import { resolveWorkspaceId } from "../lib/workspace";

import { baileysRequest as evolutionRequest } from "../lib/baileys-config";

/**
 * Light sync: calls findChats for each connected instance and upserts conversations
 * without fetching individual messages. Runs periodically to catch undecrypted/pending chats.
 */
export async function lightSync() {
  console.log("[light-sync] Starting sync for all instances...");
  const supabase = getServiceClient();

  // Get ALL instances (no is_active filter — check connection via Evolution API instead)
  const { data: instances, error: instErr } = await supabase
    .from("whatsapp_instances")
    .select("instance_name, user_id");

  if (instErr) {
    console.error("[light-sync] Error fetching instances:", instErr.message);
    return;
  }

  if (!instances || instances.length === 0) {
    console.log("[light-sync] No instances found in database");
    return;
  }

  console.log(`[light-sync] Found ${instances.length} instance(s) to check`);

  for (const inst of instances) {
    const instWorkspaceId = (inst as any).workspace_id || await resolveWorkspaceId(inst.user_id);
    try {
      // Check connection state via Evolution API
      const stateResult = await evolutionRequest(
        `/instance/connectionState/${encodeURIComponent(inst.instance_name)}`, "GET"
      );
      const state = stateResult?.instance?.state || "close";
      if (state !== "open") {
        console.log(`[light-sync] ${inst.instance_name}: skipped (state=${state})`);
        continue;
      }

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

      console.log(`[light-sync] findChats ${inst.instance_name}: ${chatList.length} total, ${individualChats.length} individual`);
      // Log all JIDs for debugging
      individualChats.forEach((chat: any) => {
        const jid = chat.remoteJid || chat.jid || chat.chatId || chat.owner || "";
        console.log(`[light-sync]   chat JID: ${jid} | name: ${chat.name || chat.pushName || "?"}`);
      });

      let newCount = 0;
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

        console.log(`[light-sync]   → ${rawJid}: ${exists ? "EXISTS" : "NEW"}`);
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
          workspace_id: instWorkspaceId,
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
          newCount++;
        }
      }

      console.log(`[light-sync] findChats done. ${inst.instance_name}: ${individualChats.length} chats, ${newCount} new`);

      // === Phase 2: findContacts fallback ===
      let contactNewCount = 0;
      try {
        const contactsResponse = await evolutionRequest(
          `/chat/findContacts/${encodeURIComponent(inst.instance_name)}`, "POST", {}
        );
        const contactList = Array.isArray(contactsResponse) ? contactsResponse : [];

        const individualContacts = contactList.filter((c: any) => {
          const jid = c.id || c.remoteJid || c.jid || "";
          if (!jid) return false;
          if (jid.includes("@g.us") || jid === "status@broadcast") return false;
          return jid.includes("@s.whatsapp.net") || jid.includes("@lid");
        });

        console.log(`[light-sync] findContacts ${inst.instance_name}: ${individualContacts.length} individual contacts`);
        individualContacts.forEach((c: any) => {
          const jid = c.id || c.remoteJid || c.jid || "";
          console.log(`[light-sync]   contact JID: ${jid} | pushName: ${c.pushName || c.name || "?"}`);
        });

        for (const contact of individualContacts) {
          const rawJid = contact.id || contact.remoteJid || contact.jid || "";
          if (!rawJid) continue;

          const isLid = rawJid.includes("@lid");
          const phoneNumber = rawJid.includes("@s.whatsapp.net") ? rawJid.split("@")[0] : null;
          const contactName = contact.pushName || contact.name || contact.verifiedName || null;

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

          console.log(`[light-sync]   → ${rawJid}: ${exists ? "EXISTS" : "NEW"}`);
          if (exists) continue;

          const upsertPayload: Record<string, unknown> = {
            user_id: inst.user_id,
          workspace_id: instWorkspaceId,
            remote_jid: rawJid,
            contact_name: contactName,
            instance_name: inst.instance_name,
            last_message: "Não foi possível visualizar a mensagem, abra seu smartphone para sincronizar",
            last_message_at: new Date().toISOString(),
            phone_number: phoneNumber,
          };
          if (isLid) upsertPayload.lid = rawJid;

          const { error } = await supabase.from("conversations").upsert(
            upsertPayload,
            { onConflict: "user_id,remote_jid,instance_name" }
          );
          if (error) {
            console.error(`[light-sync] Contact conv error for ${rawJid}:`, error.message);
          } else {
            contactNewCount++;
          }
        }

        console.log(`[light-sync] findContacts done. ${inst.instance_name}: ${contactNewCount} new from contacts`);
      } catch (contactErr: any) {
        console.error(`[light-sync] findContacts error for ${inst.instance_name}:`, contactErr.message);
      }

    } catch (e: any) {
      console.error(`[light-sync] Error for ${inst.instance_name}:`, e.message);
    }
  }

  console.log("[light-sync] Sync complete.");
}
