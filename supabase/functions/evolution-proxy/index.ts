import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    if (!evolution_api_url || !evolution_api_key || !evolution_instance_name) {
      return new Response(
        JSON.stringify({ error: "Evolution API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, ...params } = body;

    let result;

    switch (action) {
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

        // Try findMessages first to get actual conversations with messages
        const msgsResp = await fetch(
          `${baseUrl}/chat/findMessages/${evolution_instance_name}`,
          {
            method: "POST",
            headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
            body: JSON.stringify({ limit: 500 }),
          }
        );
        const msgsBody = await msgsResp.text();
        let allMessages: any[] = [];
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

        if (allMessages.length > 0) {
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
            // Only update name from inbound messages with a valid pushName
            if (isInbound && msg.pushName) conv.name = msg.pushName;
          }

          const convRows = Array.from(convMap).map(([jid, data]) => ({
            user_id: userId, remote_jid: jid, ...(data.name ? { contact_name: data.name } : {}), last_message: data.lastMsg, last_message_at: data.lastAt,
          }));

          let synced = 0;
          for (let i = 0; i < convRows.length; i += 100) {
            const chunk = convRows.slice(i, i + 100);
            const { error: err } = await serviceClient.from("conversations").upsert(chunk, { onConflict: "user_id,remote_jid" });
            if (!err) synced += chunk.length;
          }

          // Save messages
          for (const [jid, data] of convMap) {
            const { data: convRecord } = await serviceClient.from("conversations").select("id").eq("user_id", userId).eq("remote_jid", jid).single();
            if (!convRecord) continue;
            const inserts = data.messages.filter((m: any) => m.key?.id).map((m: any) => {
              const k = m.key;
              const c = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || null;
              let t = "text";
              if (m.message?.imageMessage) t = "image"; else if (m.message?.audioMessage) t = "audio"; else if (m.message?.videoMessage) t = "video";
              return { conversation_id: convRecord.id, user_id: userId, remote_jid: jid, content: c, message_type: t, direction: k.fromMe ? "outbound" : "inbound", status: "delivered", external_id: k.id, media_url: null, created_at: m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString() };
            });
            for (let i = 0; i < inserts.length; i += 100) {
              await serviceClient.from("messages").insert(inserts.slice(i, i + 100));
            }
          }
          result = { synced, source: "messages" };
          break;
        }

        // Fallback: No cached messages available yet. 
        // Inform user that conversations will appear as messages arrive via webhook.
        result = { synced: 0, info: "Nenhuma mensagem cacheada na instância. As conversas aparecerão automaticamente quando novas mensagens forem enviadas ou recebidas via WhatsApp." };
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

          msgRows.push({
            conversation_id: conv2.id,
            user_id: userId,
            remote_jid: jid2,
            content: messageContent,
            message_type: msgType,
            direction,
            status: "delivered",
            external_id: key.id,
            media_url: null,
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
