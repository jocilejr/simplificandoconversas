import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const event = body.event;
    const data = body.data;
    const instance = body.instance;

    // Only process incoming messages
    if (event !== "messages.upsert" || !data) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by instance name
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("evolution_instance_name", instance)
      .single();

    if (profileError || !profile) {
      console.error("No profile found for instance:", instance);
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = profile.user_id;
    const remoteJid = data.key?.remoteJid;
    const fromMe = data.key?.fromMe;
    const messageContent =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      "";
    const messageType = data.message?.imageMessage
      ? "image"
      : data.message?.audioMessage
      ? "audio"
      : data.message?.videoMessage
      ? "video"
      : "text";

    if (!remoteJid) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip status messages
    if (remoteJid === "status@broadcast") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contactName = data.pushName || remoteJid.split("@")[0];

    // Upsert conversation
    const { data: conv } = await supabase
      .from("conversations")
      .upsert(
        {
          user_id: userId,
          remote_jid: remoteJid,
          contact_name: contactName,
          last_message: messageContent || `[${messageType}]`,
          last_message_at: new Date().toISOString(),
          ...(!fromMe ? { unread_count: 1 } : {}),
        },
        { onConflict: "user_id,remote_jid" }
      )
      .select("id, unread_count")
      .single();

    if (!conv) {
      console.error("Failed to upsert conversation");
      return new Response(JSON.stringify({ error: "Failed to save conversation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment unread if inbound
    if (!fromMe) {
      await supabase
        .from("conversations")
        .update({ unread_count: (conv.unread_count || 0) + 1 })
        .eq("id", conv.id);
    }

    // Insert message
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      remote_jid: remoteJid,
      content: messageContent,
      message_type: messageType,
      direction: fromMe ? "outbound" : "inbound",
      status: "received",
      external_id: data.key?.id || null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
