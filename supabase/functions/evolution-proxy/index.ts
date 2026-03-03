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
          { headers: { apikey: evolution_api_key } }
        );
        result = await resp.json();
        break;
      }

      case "sync-chats": {
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch chats from Evolution
        const chatsResp = await fetch(
          `${evolution_api_url}/chat/findChats/${evolution_instance_name}`,
          { headers: { apikey: evolution_api_key } }
        );
        const chats = await chatsResp.json();

        if (!Array.isArray(chats)) {
          result = { synced: 0, error: "Unexpected response from Evolution API" };
          break;
        }

        let synced = 0;
        for (const chat of chats) {
          const jid = chat.id || chat.remoteJid;
          if (!jid || jid.includes("@g.us") || jid === "status@broadcast") continue;

          const contactName = chat.name || chat.pushName || chat.contact?.pushName || null;
          const lastMsg = chat.lastMessage?.message?.conversation
            || chat.lastMessage?.message?.extendedTextMessage?.text
            || chat.lastMsgContent
            || null;

          await serviceClient
            .from("conversations")
            .upsert(
              {
                user_id: userId,
                remote_jid: jid,
                contact_name: contactName,
                last_message: lastMsg,
                last_message_at: chat.lastMessage?.messageTimestamp
                  ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000).toISOString()
                  : new Date().toISOString(),
              },
              { onConflict: "user_id,remote_jid" }
            );
          synced++;
        }

        result = { synced };
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
