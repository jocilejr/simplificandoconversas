import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function downloadAndUploadMedia(
  storageClient: any,
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  messageData: any,
  messageType: string,
  userId: string,
): Promise<string | null> {
  try {
    const baseUrl = apiUrl.replace(/\/$/, "");
    let base64 = messageData.message?.base64;
    const mediaMessage = messageData.message?.imageMessage || messageData.message?.videoMessage || messageData.message?.audioMessage || messageData.message?.documentMessage;

    if (!base64 && mediaMessage) {
      try {
        const resp = await fetch(
          `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
          {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ message: messageData, convertToMp4: messageType === "audio" }),
          }
        );
        if (resp.ok) {
          const result = await resp.json();
          base64 = result?.base64;
        }
      } catch (e) {
        console.error("getBase64 error:", e.message);
      }
    }

    if (!base64) return null;

    const mimetype = mediaMessage?.mimetype || (messageType === "image" ? "image/jpeg" : messageType === "video" ? "video/mp4" : "audio/ogg");
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    };
    const ext = extMap[mimetype] || mimetype.split("/")[1] || "bin";
    const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { error: uploadError } = await storageClient.storage
      .from("chatbot-media")
      .upload(fileName, bytes, { contentType: mimetype, upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      return null;
    }

    const { data: publicUrl } = storageClient.storage.from("chatbot-media").getPublicUrl(fileName);
    return publicUrl?.publicUrl || null;
  } catch (e) {
    console.error("Media download/upload error:", e.message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Get user's Evolution API credentials
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("evolution_api_url, evolution_api_key, evolution_instance_name")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { evolution_api_url, evolution_api_key, evolution_instance_name } = profile;

    const body = await req.json();
    const { action, ...params } = body;

    // Actions that only need URL + API Key (no instance required)
    const noInstanceActions = ["fetch-instances", "create-instance", "connect-instance", "delete-instance", "set-proxy", "set-webhook"];

    if (!evolution_api_url || !evolution_api_key) {
      return new Response(
        JSON.stringify({ error: "Evolution API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!noInstanceActions.includes(action) && !evolution_instance_name) {
      return new Response(
        JSON.stringify({ error: "Nenhuma instância ativa selecionada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = evolution_api_url.replace(/\/$/, "");
    let result;

    switch (action) {
      // ─── Instance Management ───
      case "fetch-instances": {
        const resp = await fetch(`${baseUrl}/instance/fetchInstances`, {
          headers: { apikey: evolution_api_key },
        });
        result = await resp.json();
        break;
      }

      case "create-instance": {
        const instanceName = `sc-${Date.now().toString(36)}`;
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-webhook`;
        const resp = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            webhook: {
              url: webhookUrl,
              byEvents: false,
              base64: true,
              events: [
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "SEND_MESSAGE",
                "CONTACTS_SET",
                "CONTACTS_UPSERT",
                "CONTACTS_UPDATE",
                "QRCODE_UPDATED",
                "CONNECTION_UPDATE",
              ],
            },
          }),
        });
        const createResult = await resp.json();

        // Save to DB
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await serviceClient.from("evolution_instances").upsert({
          user_id: userId,
          instance_name: instanceName,
          status: "close",
          is_active: false,
        }, { onConflict: "user_id,instance_name" });

        result = { ...createResult, instanceName };
        break;
      }

      case "connect-instance": {
        const { instanceName: connInstName } = params;
        if (!connInstName) {
          return new Response(JSON.stringify({ error: "instanceName required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const resp = await fetch(`${baseUrl}/instance/connect/${connInstName}`, {
          headers: { apikey: evolution_api_key },
        });
        result = await resp.json();
        break;
      }

      case "delete-instance": {
        const { instanceName: delInstName } = params;
        if (!delInstName) {
          return new Response(JSON.stringify({ error: "instanceName required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const resp = await fetch(`${baseUrl}/instance/delete/${delInstName}`, {
          method: "DELETE",
          headers: { apikey: evolution_api_key },
        });
        result = await resp.json();

        // Remove from DB
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await serviceClient.from("evolution_instances")
          .delete()
          .eq("user_id", userId)
          .eq("instance_name", delInstName);
        break;
      }

      case "set-proxy": {
        const { instanceName: proxyInstName, proxyUrl } = params;
        if (!proxyInstName) {
          return new Response(JSON.stringify({ error: "instanceName required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const resp = await fetch(`${baseUrl}/instance/proxy/${proxyInstName}`, {
          method: "POST",
          headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !!proxyUrl, proxy: proxyUrl || "" }),
        });
        result = await resp.json();
        break;
      }
      case "set-webhook": {
        const { instanceName: whInstName } = params;
        if (!whInstName) {
          return new Response(JSON.stringify({ error: "instanceName required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-webhook`;
        console.log(`[set-webhook] Setting webhook for ${whInstName} -> ${webhookUrl}`);
        const resp = await fetch(`${baseUrl}/webhook/set/${whInstName}`, {
          method: "POST",
          headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: true,
            events: [
              "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE",
              "CONTACTS_SET", "CONTACTS_UPSERT", "CONTACTS_UPDATE",
              "QRCODE_UPDATED", "CONNECTION_UPDATE",
            ],
          }),
        });
        result = await resp.json();
        console.log(`[set-webhook] Result for ${whInstName}:`, JSON.stringify(result));
        break;
      }

      case "test-connection": {
        const resp = await fetch(
          `${evolution_api_url}/instance/connectionState/${evolution_instance_name}`,
          { headers: { apikey: evolution_api_key } }
        );
        result = await resp.json();
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

        const resp = await fetch(
          `${evolution_api_url}/message/${endpoint}/${evolution_instance_name}`,
          {
            method: "POST",
            headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        result = await resp.json();

        // Save outbound message to DB
        if (resp.ok) {
          // Find or create conversation
          const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;

          const { data: conv } = await serviceClient
            .from("conversations")
            .upsert(
              {
                user_id: userId,
                remote_jid: jid,
                last_message: message || `[${messageType}]`,
                last_message_at: new Date().toISOString(),
                instance_name: evolution_instance_name,
              },
              { onConflict: "user_id,remote_jid" }
            )
            .select("id")
            .single();

          if (conv) {
            await serviceClient.from("messages").insert({
              conversation_id: conv.id,
              user_id: userId,
              remote_jid: jid,
              content: message,
              message_type: messageType,
              direction: "outbound",
              status: "sent",
              external_id: result?.key?.id || null,
              media_url: mediaUrl || null,
            });
          }
        }
        break;
      }

      case "fetch-chats": {
        const resp = await fetch(
          `${evolution_api_url}/chat/findChats/${evolution_instance_name}`,
          {
            method: "POST",
            headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        result = await resp.json();
        break;
      }

      case "sync-chats": {
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const baseUrl = evolution_api_url.replace(/\/$/, "");

        // Fetch all user instances to sync from each one
        const { data: userInstances } = await serviceClient
          .from("evolution_instances")
          .select("instance_name")
          .eq("user_id", userId);

        const instancesToSync = userInstances?.map((i: any) => i.instance_name) || [];
        // Always include the profile instance as fallback
        if (evolution_instance_name && !instancesToSync.includes(evolution_instance_name)) {
          instancesToSync.push(evolution_instance_name);
        }

        let totalSynced = 0;

        for (const currentInstanceName of instancesToSync) {
          console.log(`[sync-chats] Syncing instance: ${currentInstanceName}`);
          
          // Try findMessages for this instance
          let allMessages: any[] = [];
          
          const msgsResp = await fetch(
            `${baseUrl}/chat/findMessages/${currentInstanceName}`,
            {
              method: "POST",
              headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
              body: JSON.stringify({ limit: 500 }),
            }
          );
          const msgsBody = await msgsResp.text();
          console.log(`[sync-chats] findMessages ${currentInstanceName} status: ${msgsResp.status}, body length: ${msgsBody.length}, preview: ${msgsBody.substring(0, 200)}`);
          
          try {
            const parsed = JSON.parse(msgsBody);
            if (Array.isArray(parsed)) allMessages = parsed;
            else if (parsed.messages?.records) allMessages = parsed.messages.records;
            else {
              for (const key of Object.keys(parsed)) {
                if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
                  allMessages = parsed[key];
                  break;
                }
              }
            }
          } catch (_) {}

          // Fallback: try findChats if no messages found
          if (allMessages.length === 0) {
            console.log(`[sync-chats] No messages for ${currentInstanceName}, trying findChats...`);
            try {
              const chatsResp = await fetch(
                `${baseUrl}/chat/findChats/${currentInstanceName}`,
                {
                  method: "POST",
                  headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                }
              );
              const chatsBody = await chatsResp.text();
              console.log(`[sync-chats] findChats ${currentInstanceName} status: ${chatsResp.status}, body length: ${chatsBody.length}, preview: ${chatsBody.substring(0, 300)}`);
              
              const chats = JSON.parse(chatsBody);
              if (Array.isArray(chats) && chats.length > 0) {
                // Convert chats to conversation rows directly
                const chatRows = chats
                  .filter((ch: any) => ch.id?.includes("@s.whatsapp.net") || ch.remoteJid?.includes("@s.whatsapp.net"))
                  .map((ch: any) => ({
                    user_id: userId,
                    remote_jid: ch.id || ch.remoteJid,
                    ...(ch.name || ch.pushName ? { contact_name: ch.name || ch.pushName } : {}),
                    last_message: ch.lastMessage?.message?.conversation || ch.lastMessage?.message?.extendedTextMessage?.text || ch.lastMsgContent || null,
                    last_message_at: ch.updatedAt || ch.lastMessage?.messageTimestamp ? new Date(Number(ch.lastMessage?.messageTimestamp || 0) * 1000).toISOString() : new Date().toISOString(),
                    instance_name: currentInstanceName,
                  }));

                if (chatRows.length > 0) {
                  console.log(`[sync-chats] Found ${chatRows.length} chats from findChats for ${currentInstanceName}`);
                  for (let i = 0; i < chatRows.length; i += 100) {
                    const chunk = chatRows.slice(i, i + 100);
                    const { error: err } = await serviceClient.from("conversations").upsert(chunk, { onConflict: "user_id,remote_jid" });
                    if (!err) totalSynced += chunk.length;
                  }
                }
              }
            } catch (e) {
              console.error(`[sync-chats] findChats error for ${currentInstanceName}:`, e.message);
            }
            continue;
          }

          console.log(`[sync-chats] Found ${allMessages.length} messages for ${currentInstanceName}`);

          // Group by remoteJid
          const convMap = new Map<string, { name: string | null; lastMsg: string | null; lastAt: string; messages: any[] }>();
          for (const msg of allMessages) {
            const key = msg.key || {};
            const jid = key.remoteJid;
            if (!jid || !jid.includes("@s.whatsapp.net")) continue;
            const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "[mídia]";
            const ts = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString();
            const isInbound = !key.fromMe;
            const pushName = isInbound ? (msg.pushName || null) : null;
            if (!convMap.has(jid)) convMap.set(jid, { name: pushName, lastMsg: content, lastAt: ts, messages: [] });
            const conv = convMap.get(jid)!;
            conv.messages.push(msg);
            if (ts > conv.lastAt) { conv.lastMsg = content; conv.lastAt = ts; }
            if (isInbound && msg.pushName) conv.name = msg.pushName;
          }

          const convRows = Array.from(convMap).map(([jid, data]) => ({
            user_id: userId, remote_jid: jid, ...(data.name ? { contact_name: data.name } : {}), last_message: data.lastMsg, last_message_at: data.lastAt, instance_name: currentInstanceName,
          }));

          let synced = 0;
          for (let i = 0; i < convRows.length; i += 100) {
            const chunk = convRows.slice(i, i + 100);
            const { error: err } = await serviceClient.from("conversations").upsert(chunk, { onConflict: "user_id,remote_jid" });
            if (!err) synced += chunk.length;
          }

          // Save messages (with media download for media types)
          const serviceClientMedia = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          for (const [jid, data] of convMap) {
            const { data: convRecord } = await serviceClient.from("conversations").select("id").eq("user_id", userId).eq("remote_jid", jid).single();
            if (!convRecord) continue;
            const inserts = [];
            for (const m of data.messages) {
              if (!m.key?.id) continue;
              const k = m.key;
              const c = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || null;
              let t = "text";
              if (m.message?.imageMessage) t = "image"; else if (m.message?.audioMessage) t = "audio"; else if (m.message?.videoMessage) t = "video";
              
              let mediaUrl: string | null = null;
              if (t !== "text") {
                mediaUrl = await downloadAndUploadMedia(serviceClientMedia, evolution_api_url, evolution_api_key, currentInstanceName, m, t, userId);
              }
              
              inserts.push({ conversation_id: convRecord.id, user_id: userId, remote_jid: jid, content: c, message_type: t, direction: k.fromMe ? "outbound" : "inbound", status: "delivered", external_id: k.id, media_url: mediaUrl, created_at: m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString() });
            }
            for (let i = 0; i < inserts.length; i += 100) {
              await serviceClient.from("messages").insert(inserts.slice(i, i + 100));
            }
          }
          totalSynced += synced;
        }

        if (totalSynced > 0) {
          result = { synced: totalSynced, source: "messages" };
        } else {
          result = { synced: 0, info: "Nenhuma mensagem cacheada nas instâncias. As conversas aparecerão automaticamente quando novas mensagens forem enviadas ou recebidas via WhatsApp." };
        }
        break;
      }

      case "fetch-profile-picture": {
        const { remoteJid: picJid } = params;
        if (!picJid) {
          return new Response(JSON.stringify({ error: "remoteJid required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const number = picJid.split("@")[0];
        const baseUrlPic = evolution_api_url.replace(/\/$/, "");
        try {
          const picResp = await fetch(
            `${baseUrlPic}/chat/fetchProfilePictureUrl/${evolution_instance_name}`,
            {
              method: "POST",
              headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
              body: JSON.stringify({ number }),
            }
          );
          const picData = await picResp.json();
          result = { profilePictureUrl: picData?.profilePictureUrl || picData?.picture || picData?.url || null };
        } catch {
          result = { profilePictureUrl: null };
        }
        break;
      }

      case "fetch-profile-pictures": {
        const { remoteJids: jids } = params;
        if (!jids || !Array.isArray(jids)) {
          return new Response(JSON.stringify({ error: "remoteJids required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const baseUrlPics = evolution_api_url.replace(/\/$/, "");
        const photos: Record<string, string> = {};
        // Fetch in parallel, max 10 at a time
        const batches = [];
        for (let i = 0; i < jids.length; i += 10) {
          batches.push(jids.slice(i, i + 10));
        }
        for (const batch of batches) {
          await Promise.allSettled(
            batch.map(async (jid: string) => {
              try {
                const num = jid.split("@")[0];
                const resp = await fetch(
                  `${baseUrlPics}/chat/fetchProfilePictureUrl/${evolution_instance_name}`,
                  {
                    method: "POST",
                    headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                    body: JSON.stringify({ number: num }),
                  }
                );
                const d = await resp.json();
                const url = d?.profilePictureUrl || d?.picture || d?.url;
                if (url) photos[jid] = url;
              } catch {}
            })
          );
        }
        result = photos;
        break;
      }

      case "fetch-contact-names": {
        // Fetch contacts from Evolution API and update conversation names
        const baseUrlContacts = evolution_api_url.replace(/\/$/, "");
        const serviceClientContacts = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        try {
          const contactsResp = await fetch(
            `${baseUrlContacts}/chat/findContacts/${evolution_instance_name}`,
            {
              method: "POST",
              headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }
          );
          const contactsRaw = await contactsResp.text();
          console.log("findContacts status:", contactsResp.status, "body preview:", contactsRaw.substring(0, 500));
          
          let contacts: any[] = [];
          try {
            const parsed = JSON.parse(contactsRaw);
            if (Array.isArray(parsed)) contacts = parsed;
            else if (parsed.contacts && Array.isArray(parsed.contacts)) contacts = parsed.contacts;
            else {
              for (const key of Object.keys(parsed)) {
                if (Array.isArray(parsed[key])) { contacts = parsed[key]; break; }
              }
            }
          } catch {}
          
          console.log("Contacts found:", contacts.length);
          
          // Build a map of jid -> name from contacts
          const nameMap = new Map<string, string>();
          for (const contact of contacts) {
            const jid = contact.remoteJid || contact.jid;
            const name = contact.pushName || contact.name || contact.notify || contact.verifiedName || contact.shortName;
            if (!jid || !name || jid === "status@broadcast" || !jid.includes("@s.whatsapp.net")) continue;
            nameMap.set(jid, name);
          }
          
          console.log("Valid contacts with names:", nameMap.size);

          // Get existing conversations for this user
          const { data: existingConvs } = await serviceClientContacts
            .from("conversations")
            .select("id, remote_jid")
            .eq("user_id", userId);
          
          let updated = 0;
          if (existingConvs) {
            // Update only conversations that have a matching contact
            const updates = existingConvs
              .filter(c => nameMap.has(c.remote_jid))
              .map(c => ({ id: c.id, remote_jid: c.remote_jid, user_id: userId, contact_name: nameMap.get(c.remote_jid)! }));
            
            console.log("Conversations to update:", updates.length);
            
            for (const u of updates) {
              await serviceClientContacts
                .from("conversations")
                .update({ contact_name: u.contact_name })
                .eq("id", u.id);
              updated++;
            }
          }
          
          // For conversations still without names, try to get pushName from recent messages
          const stillNoName = (existingConvs || []).filter(c => !nameMap.has(c.remote_jid));
          if (stillNoName.length > 0) {
            const baseUrlMsg = evolution_api_url.replace(/\/$/, "");
            for (const conv of stillNoName) {
              try {
                const msgResp = await fetch(
                  `${baseUrlMsg}/chat/findMessages/${evolution_instance_name}`,
                  {
                    method: "POST",
                    headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                    body: JSON.stringify({ where: { key: { remoteJid: conv.remote_jid, fromMe: false } }, limit: 1 }),
                  }
                );
                const msgData = await msgResp.json();
                const msgs = Array.isArray(msgData) ? msgData : msgData?.messages?.records || msgData?.records || [];
                if (msgs.length > 0 && msgs[0].pushName) {
                  await serviceClientContacts
                    .from("conversations")
                    .update({ contact_name: msgs[0].pushName })
                    .eq("id", conv.id);
                  updated++;
                  console.log("Updated from pushName:", conv.remote_jid, "->", msgs[0].pushName);
                }
              } catch {}
            }
          }
          
          result = { updated, totalContacts: contacts.length, validContacts: nameMap.size };
        } catch (e) {
          console.error("fetch-contact-names error:", e.message);
          result = { updated: 0, error: e.message };
        }
        break;
      }

      case "fetch-messages": {
        const { remoteJid, count = 50 } = params;
        if (!remoteJid) {
          return new Response(JSON.stringify({ error: "remoteJid required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const baseUrl2 = evolution_api_url.replace(/\/$/, "");
        const msgResp = await fetch(
          `${baseUrl2}/chat/findMessages/${evolution_instance_name}`,
          {
            method: "POST",
            headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
            body: JSON.stringify({
              where: { key: { remoteJid: remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net` } },
              limit: count,
            }),
          }
        );
        const msgBody = await msgResp.text();
        console.log("findMessages status:", msgResp.status, "body:", msgBody.substring(0, 1000));

        let rawMessages: any[] = [];
        try {
          const parsed = JSON.parse(msgBody);
          if (Array.isArray(parsed)) {
            rawMessages = parsed;
          } else if (parsed.messages && Array.isArray(parsed.messages)) {
            rawMessages = parsed.messages;
          } else if (parsed.records && Array.isArray(parsed.records)) {
            rawMessages = parsed.records;
          } else {
            // Maybe the response wraps in a different structure
            console.log("findMessages keys:", Object.keys(parsed));
            // Try to find any array in the response
            for (const key of Object.keys(parsed)) {
              if (Array.isArray(parsed[key])) {
                rawMessages = parsed[key];
                console.log("Found messages in key:", key, "count:", rawMessages.length);
                break;
              }
            }
          }
        } catch (e) {
          console.log("findMessages parse error:", e.message);
        }

        console.log("rawMessages count:", rawMessages.length);

        const serviceClient2 = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const jid2 = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;
        const { data: conv2 } = await serviceClient2
          .from("conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("remote_jid", jid2)
          .single();

        if (!conv2) {
          result = { imported: 0, error: "Conversation not found" };
          break;
        }

        const msgRows: any[] = [];
        for (const msg of rawMessages) {
          const key = msg.key || {};
          const messageContent = msg.message?.conversation
            || msg.message?.extendedTextMessage?.text
            || msg.message?.imageMessage?.caption
            || msg.message?.videoMessage?.caption
            || null;

          const direction = key.fromMe ? "outbound" : "inbound";
          let msgType = "text";
          if (msg.message?.imageMessage) msgType = "image";
          else if (msg.message?.audioMessage) msgType = "audio";
          else if (msg.message?.videoMessage) msgType = "video";
          else if (msg.message?.documentMessage) msgType = "document";

          if (!key.id) continue;

          let mediaUrl: string | null = null;
          if (msgType !== "text") {
            mediaUrl = await downloadAndUploadMedia(serviceClient2, evolution_api_url, evolution_api_key, evolution_instance_name, msg, msgType, userId);
          }

          msgRows.push({
            conversation_id: conv2.id,
            user_id: userId,
            remote_jid: jid2,
            content: messageContent,
            message_type: msgType,
            direction,
            status: "delivered",
            external_id: key.id,
            media_url: mediaUrl,
            created_at: msg.messageTimestamp
              ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
              : new Date().toISOString(),
          });
        }

        let imported = 0;
        for (let i = 0; i < msgRows.length; i += 100) {
          const chunk = msgRows.slice(i, i + 100);
          const { error: insErr } = await serviceClient2
            .from("messages")
            .insert(chunk);
          if (!insErr) imported += chunk.length;
          else console.log("Message insert error:", insErr.message);
        }

        result = { imported, total: rawMessages.length };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
