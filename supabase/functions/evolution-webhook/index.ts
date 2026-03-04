import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  return text.substring(0, max) + "…";
}

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
    const rawContent =
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

    // Truncate last_message preview to 50 chars
    const messageContent = rawContent;
    const lastMessagePreview = truncate(rawContent, 50) || `[${messageType}]`;

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
      await supabase
        .from("conversations")
        .upsert(
          {
            user_id: userId,
            remote_jid: remoteJid,
            last_message: lastMessagePreview,
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

    // Upsert conversation WITHOUT unread_count (avoid overwrite)
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      remote_jid: remoteJid,
      last_message: lastMessagePreview,
      last_message_at: new Date().toISOString(),
    };
    if (contactName) {
      upsertData.contact_name = contactName;
    }

    const { data: conv } = await supabase
      .from("conversations")
      .upsert(upsertData, { onConflict: "user_id,remote_jid" })
      .select("id")
      .single();

    if (!conv) {
      console.error("Failed to upsert conversation");
      return new Response(JSON.stringify({ error: "Failed to save conversation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomically increment unread_count for inbound messages using RPC-like raw update
    if (!fromMe) {
      await supabase.rpc("increment_unread", { conv_id: conv.id });
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

    // === AUTO-TRIGGER: Check keyword matching for inbound messages ===
    if (!fromMe && messageContent) {
      try {
        await checkAndTriggerFlows(supabase, userId, remoteJid, messageContent, conv.id);
      } catch (triggerErr) {
        console.error("Flow trigger error (non-fatal):", triggerErr);
      }
    }

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

async function checkAndTriggerFlows(
  supabase: any,
  userId: string,
  remoteJid: string,
  messageContent: string,
  conversationId: string
) {
  // 1. Fetch all active flows for this user
  const { data: flows, error: flowsErr } = await supabase
    .from("chatbot_flows")
    .select("id, nodes")
    .eq("user_id", userId)
    .eq("active", true);

  if (flowsErr || !flows || flows.length === 0) {
    return;
  }

  const contentLower = messageContent.trim().toLowerCase();

  for (const flow of flows) {
    const nodes = (flow.nodes || []) as any[];
    let matched = false;

    // 2. Look for trigger nodes (flat or inside groups)
    for (const node of nodes) {
      const data = node.data || {};
      
      // Direct trigger node
      if (data.type === "trigger" && data.triggerKeyword) {
        const keyword = data.triggerKeyword.trim().toLowerCase();
        if (keyword && contentLower === keyword) {
          matched = true;
          break;
        }
      }
      
      // Group node: check steps for triggers
      if (data.type === "group" && data.steps) {
        for (const step of data.steps) {
          if (step.data?.type === "trigger" && step.data?.triggerKeyword) {
            const keyword = step.data.triggerKeyword.trim().toLowerCase();
            if (keyword && contentLower === keyword) {
              matched = true;
              break;
            }
          }
        }
        if (matched) break;
      }
    }

    if (!matched) continue;

    // 3. Check if there's already a running execution for this jid + flow
    const { data: existing } = await supabase
      .from("flow_executions")
      .select("id")
      .eq("user_id", userId)
      .eq("flow_id", flow.id)
      .eq("remote_jid", remoteJid)
      .eq("status", "running")
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Flow ${flow.id} already running for ${remoteJid}, skipping`);
      continue;
    }

    // 4. Call execute-flow via HTTP with service role key
    console.log(`Triggering flow ${flow.id} for ${remoteJid} (keyword match)`);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fire-and-forget: don't await the response to avoid webhook timeout
    fetch(`${supabaseUrl}/functions/v1/execute-flow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        flowId: flow.id,
        remoteJid,
        conversationId,
        userId,
      }),
    })
      .then(r => r.json())
      .then(r => console.log(`Flow ${flow.id} trigger result:`, r))
      .catch(e => console.error(`Flow ${flow.id} call error:`, e));
  }
}
