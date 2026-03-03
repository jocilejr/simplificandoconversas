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

        // Try multiple endpoints to find contacts/chats
        let chats: any[] = [];
        const baseUrl = evolution_api_url.replace(/\/$/, "");

        // Try findContacts first (more reliable for getting contact list)
        const contactsResp = await fetch(
          `${baseUrl}/chat/findContacts/${evolution_instance_name}`,
          {
            method: "POST",
            headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        const contactsBody = await contactsResp.text();
        console.log("findContacts status:", contactsResp.status, "body:", contactsBody.substring(0, 500));

        try {
          const contactsData = JSON.parse(contactsBody);
          if (Array.isArray(contactsData) && contactsData.length > 0) {
            chats = contactsData;
          }
        } catch (_) { /* ignore parse errors */ }

        // If findContacts returned nothing, try findChats
        if (chats.length === 0) {
          const chatsResp = await fetch(
            `${baseUrl}/chat/findChats/${evolution_instance_name}`,
            {
              method: "POST",
              headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }
          );
          const chatsBody = await chatsResp.text();
          console.log("findChats status:", chatsResp.status, "body:", chatsBody.substring(0, 500));

          try {
            const chatsData = JSON.parse(chatsBody);
            if (Array.isArray(chatsData)) {
              chats = chatsData;
            }
          } catch (_) { /* ignore */ }
        }

        // If still nothing, try GET method as fallback
        if (chats.length === 0) {
          const getResp = await fetch(
            `${baseUrl}/chat/findChats/${evolution_instance_name}`,
            { headers: { apikey: evolution_api_key } }
          );
          const getBody = await getResp.text();
          console.log("findChats GET status:", getResp.status, "body:", getBody.substring(0, 500));

          try {
            const getData = JSON.parse(getBody);
            if (Array.isArray(getData)) {
              chats = getData;
            }
          } catch (_) { /* ignore */ }
        }

        console.log("Total chats found:", chats.length);

        if (chats.length === 0) {
          result = { synced: 0, debug: "No chats returned from any endpoint" };
          break;
        }

        // Build batch of conversations to upsert
        const rows: any[] = [];
        for (const chat of chats) {
          const jid = chat.remoteJid || chat.id;
          if (!jid || !jid.includes("@s.whatsapp.net")) continue;
          if (jid === "status@broadcast") continue;

          const contactName = chat.pushName || chat.name || chat.contact?.pushName || null;

          rows.push({
            user_id: userId,
            remote_jid: jid,
            contact_name: contactName,
            last_message: chat.lastMessage?.message?.conversation
              || chat.lastMessage?.message?.extendedTextMessage?.text
              || chat.lastMsgContent
              || null,
            last_message_at: chat.lastMessage?.messageTimestamp
              ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000).toISOString()
              : new Date().toISOString(),
          });
        }

        // Batch upsert in chunks of 100
        let synced = 0;
        for (let i = 0; i < rows.length; i += 100) {
          const chunk = rows.slice(i, i + 100);
          const { error: upsertErr } = await serviceClient
            .from("conversations")
            .upsert(chunk, { onConflict: "user_id,remote_jid" });
          if (!upsertErr) synced += chunk.length;
          else console.log("Upsert error:", upsertErr.message);
        }

        result = { synced };
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
        console.log("findMessages status:", msgResp.status, "body length:", msgBody.length);

        let rawMessages: any[] = [];
        try {
          const parsed = JSON.parse(msgBody);
          rawMessages = Array.isArray(parsed) ? parsed : (parsed.messages || parsed.records || []);
        } catch (_) { /* ignore */ }

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
