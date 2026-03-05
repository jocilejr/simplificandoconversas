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

async function downloadAndUploadMedia(
  supabase: any,
  profile: { evolution_api_url: string; evolution_api_key: string; evolution_instance_name: string },
  messageData: any,
  messageType: string,
  userId: string,
): Promise<string | null> {
  try {
    const { evolution_api_url, evolution_api_key, evolution_instance_name } = profile;
    const baseUrl = evolution_api_url.replace(/\/$/, "");

    // Try to get base64 from the message
    let base64 = messageData.message?.base64;
    const mediaMessage = messageData.message?.imageMessage || messageData.message?.videoMessage || messageData.message?.audioMessage || messageData.message?.documentMessage;

    if (!base64 && mediaMessage) {
      // Use Evolution API to get base64
      try {
        const resp = await fetch(
          `${baseUrl}/chat/getBase64FromMediaMessage/${evolution_instance_name}`,
          {
            method: "POST",
            headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
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

    // Determine mimetype and extension
    const mimetype = mediaMessage?.mimetype || (messageType === "image" ? "image/jpeg" : messageType === "video" ? "video/mp4" : "audio/ogg");
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    };
    const ext = extMap[mimetype] || mimetype.split("/")[1] || "bin";
    const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;

    // Decode base64 and upload
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from("chatbot-media")
      .upload(fileName, bytes, { contentType: mimetype, upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      return null;
    }

    const { data: publicUrl } = supabase.storage.from("chatbot-media").getPublicUrl(fileName);
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
    const body = await req.json();
    console.log("Webhook event:", body.event, "instance:", body.instance);

    const event = body.event;
    const data = body.data;
    const instance = body.instance;

    // Handle message status updates (delivered, read, etc.)
    if (event === "messages.update" && data) {
      try {
        await handleMessageStatusUpdate(data, instance);
      } catch (e) {
        console.error("Status update error (non-fatal):", e.message);
      }
      return new Response(JSON.stringify({ ok: true, statusUpdated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      data.message?.videoMessage?.caption ||
      "";
    const messageType = data.message?.imageMessage
      ? "image"
      : data.message?.audioMessage
      ? "audio"
      : data.message?.videoMessage
      ? "video"
      : data.message?.documentMessage
      ? "document"
      : "text";
    const externalId = key.id || data.keyId || null;

    // Truncate last_message preview to 50 chars
    const messageContent = rawContent;
    const lastMessagePreview = truncate(rawContent, 50) || `[${messageType}]`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by instance name (check evolution_instances first, then profiles)
    let userId: string | null = null;
    let profile: any = null;

    const { data: instanceRecord } = await supabase
      .from("evolution_instances")
      .select("user_id")
      .eq("instance_name", instance)
      .limit(1)
      .single();

    if (instanceRecord) {
      userId = instanceRecord.user_id;
    } else {
      // Fallback: check profiles table
      const { data: profileRecord } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("evolution_instance_name", instance)
        .single();
      if (profileRecord) userId = profileRecord.user_id;
    }

    if (!userId) {
      console.error("No user found for instance:", instance);
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile for API credentials (needed for media download)
    const { data: profileData } = await supabase
      .from("profiles")
      .select("evolution_api_url, evolution_api_key, evolution_instance_name")
      .eq("user_id", userId)
      .single();
    profile = profileData;

    if (!remoteJid) {
      return new Response(JSON.stringify({ ok: true, skipped: "no remoteJid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip status messages and group messages
    if (remoteJid === "status@broadcast" || remoteJid.includes("@g.us")) {
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
            instance_name: instance,
          },
          { onConflict: "user_id,remote_jid,instance_name" }
        );
      return new Response(JSON.stringify({ ok: true, updated: "conversation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download and upload media if applicable
    let mediaUrl: string | null = null;
    if (messageType !== "text" && profile?.evolution_api_url && profile?.evolution_api_key) {
      mediaUrl = await downloadAndUploadMedia(supabase, profile as any, data, messageType, userId);
      console.log("Media uploaded:", mediaUrl ? "success" : "failed/skipped");
    }

    // Only use pushName for contact name on INBOUND messages (not fromMe)
    const contactName = !fromMe ? (data.pushName || null) : null;

    // Upsert conversation WITHOUT unread_count (avoid overwrite)
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      remote_jid: remoteJid,
      last_message: lastMessagePreview,
      last_message_at: new Date().toISOString(),
      instance_name: instance,
    };
    if (contactName) {
      upsertData.contact_name = contactName;
    }

    const { data: conv } = await supabase
      .from("conversations")
      .upsert(upsertData, { onConflict: "user_id,remote_jid,instance_name" })
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
    console.log("Inserting message:", { remoteJid, direction: fromMe ? "outbound" : "inbound", content: messageContent?.substring(0, 50), mediaUrl });
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      remote_jid: remoteJid,
      content: messageContent,
      message_type: messageType,
      direction: fromMe ? "outbound" : "inbound",
      status: "received",
      external_id: externalId,
      media_url: mediaUrl,
    });

    // === CHECK FOR WAITING_REPLY: Resume flow if contact responded ===
    let flowResumed = false;
    if (!fromMe && messageContent) {
      try {
        flowResumed = await checkAndResumeWaitingReply(supabase, userId, remoteJid, conv.id, instance);
      } catch (resumeErr) {
        console.error("Resume waiting_reply error (non-fatal):", resumeErr);
      }
    }

    // === AUTO-TRIGGER: Check keyword matching for inbound messages (skip if we just resumed) ===
    if (!fromMe && messageContent && !flowResumed) {
      try {
        await checkAndTriggerFlows(supabase, userId, remoteJid, messageContent, conv.id, instance);
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
  conversationId: string,
  instanceName: string
) {
  // 1. Fetch all active flows for this user
  const { data: flows, error: flowsErr } = await supabase
    .from("chatbot_flows")
    .select("id, nodes, instance_names")
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
      if ((data.type === "group" || data.type === "groupBlock") && data.steps) {
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

    // Filter by instance_names
    const allowedInstances = (flow as any).instance_names || [];
    if (allowedInstances.length > 0 && !allowedInstances.includes(instanceName)) {
      console.log(`Flow ${flow.id} not allowed for instance ${instanceName}, skipping`);
      continue;
    }

    // 3. Check if there's already a running/waiting execution for this jid + flow
    const { data: existing } = await supabase
      .from("flow_executions")
      .select("id")
      .eq("user_id", userId)
      .eq("flow_id", flow.id)
      .eq("remote_jid", remoteJid)
      .in("status", ["running", "waiting_click", "waiting_reply"])
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Flow ${flow.id} already active for ${remoteJid} (id=${existing[0].id}), skipping`);
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
        instanceName,
      }),
    })
      .then(r => r.json())
      .then(r => console.log(`Flow ${flow.id} trigger result:`, r))
      .catch(e => console.error(`Flow ${flow.id} call error:`, e));
}
}

async function checkAndResumeWaitingReply(
  supabase: any,
  userId: string,
  remoteJid: string,
  conversationId: string,
  instanceName: string
): Promise<boolean> {
  // Find active execution waiting for reply from this contact
  const { data: waitingExecs } = await supabase
    .from("flow_executions")
    .select("id, flow_id, waiting_node_id")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .eq("status", "waiting_reply")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!waitingExecs || waitingExecs.length === 0) return false;

  const exec = waitingExecs[0];
  const waitingNodeId = exec.waiting_node_id;
  console.log(`[webhook] Contact ${remoteJid} replied, resuming execution ${exec.id}, waiting_node_id=${waitingNodeId}`);

  // Cancel any pending timeouts for this execution
  await supabase
    .from("flow_timeouts")
    .update({ processed: true })
    .eq("execution_id", exec.id)
    .eq("processed", false);

  // Mark execution as completed (the resume will create a new one)
  await supabase
    .from("flow_executions")
    .update({ status: "completed" })
    .eq("id", exec.id);

  if (!waitingNodeId) {
    console.log(`[webhook] No waiting_node_id stored for execution ${exec.id}, cannot resume`);
    return true; // Still return true to prevent re-trigger
  }

  // Find the flow to get edges
  const { data: flow } = await supabase
    .from("chatbot_flows")
    .select("edges")
    .eq("id", exec.flow_id)
    .single();

  if (!flow) return true;

  const edges = (flow.edges || []) as any[];

  // Find the output-0 edge from the waiting node
  const normalEdge = edges.find(
    (e: any) => e.source === waitingNodeId && (e.sourceHandle === "output-0" || !e.sourceHandle)
  );

  if (!normalEdge) {
    console.log(`[webhook] No next node found for waiting_node_id=${waitingNodeId}`);
    return true;
  }

  const nextNodeId = normalEdge.target;

  // Resume flow from the next node
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  fetch(`${supabaseUrl}/functions/v1/execute-flow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      flowId: exec.flow_id,
      remoteJid,
      conversationId,
      userId,
      resumeFromNodeId: nextNodeId,
      instanceName,
    }),
  })
    .then((r) => r.json())
    .then((r) => console.log(`[webhook] Resume waiting_reply result:`, r))
    .catch((e) => console.error(`[webhook] Resume waiting_reply error:`, e));

  return true;
}
