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
    console.log("Webhook event:", body.event, "instance:", body.instance);

    const event = body.event;
    const data = body.data;
    const instance = body.instance;

    // Process new messages (inbound and outbound)
    if (!["messages.upsert", "send.message"].includes(event) || !data) {
      return new Response(JSON.stringify({ ok: true, skipped: event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message data - format varies between events
    const key = data.key || {};
    const remoteJid = key.remoteJid || data.remoteJid;
    const fromMe = key.fromMe ?? data.fromMe ?? false;
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
    const externalId = key.id || data.keyId || null;

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

    if (!remoteJid) {
      return new Response(JSON.stringify({ ok: true, skipped: "no remoteJid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip status messages and LID format
    if (remoteJid === "status@broadcast" || remoteJid.includes("@lid")) {
      return new Response(JSON.stringify({ ok: true, skipped: "filtered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip outbound messages sent via our proxy (already saved by proxy)
    if (fromMe && event === "send.message") {
      // Update conversation metadata but DON'T overwrite contact_name with sender's pushName
      await supabase
        .from("conversations")
        .upsert(
          {
            user_id: userId,
            remote_jid: remoteJid,
            last_message: messageContent || `[${messageType}]`,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "user_id,remote_jid" }
        );
      return new Response(JSON.stringify({ ok: true, updated: "conversation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only use pushName for contact name on INBOUND messages (not fromMe)
    const contactName = !fromMe ? (data.pushName || null) : null;

    // Upsert conversation - only set contact_name if we have a real name from inbound
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      remote_jid: remoteJid,
      last_message: messageContent || `[${messageType}]`,
      last_message_at: new Date().toISOString(),
      ...(!fromMe ? { unread_count: 1 } : {}),
    };
    if (contactName) {
      upsertData.contact_name = contactName;
    }

    const { data: conv } = await supabase
      .from("conversations")
      .upsert(upsertData, { onConflict: "user_id,remote_jid" })
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
    console.log("Inserting message:", { remoteJid, direction: fromMe ? "outbound" : "inbound", content: messageContent?.substring(0, 50) });
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      remote_jid: remoteJid,
      content: messageContent,
      message_type: messageType,
      direction: fromMe ? "outbound" : "inbound",
      status: "received",
      external_id: externalId,
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
