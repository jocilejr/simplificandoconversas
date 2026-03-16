import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const router = Router();

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

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  return text.substring(0, max) + "…";
}

async function downloadAndUploadMedia(
  instanceName: string,
  messageData: any,
  messageType: string,
  userId: string,
): Promise<string | null> {
  try {
    let base64 = messageData.message?.base64;
    const mediaMessage = messageData.message?.imageMessage || messageData.message?.videoMessage || messageData.message?.audioMessage || messageData.message?.documentMessage;

    if (!base64 && mediaMessage) {
      try {
        const result = await evolutionRequest(
          `/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`,
          "POST",
          { message: messageData, convertToMp4: messageType === "audio" }
        );
        base64 = result?.base64;
      } catch (e: any) {
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

    // Salvar no filesystem (volume compartilhado com Nginx)
    const mediaDir = path.join("/media-files", userId);
    await fs.mkdir(mediaDir, { recursive: true });

    const localFileName = `${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(mediaDir, localFileName);
    await fs.writeFile(filePath, bytes);

    // URL pública servida pelo Nginx
    const externalBase = process.env.API_URL || "";
    return `${externalBase}/media/${userId}/${localFileName}`;
  } catch (e: any) {
    console.error("Media download/upload error:", e.message);
    return null;
  }
}

router.post("/*", async (req, res) => {
  try {
    const body = req.body;
    const event = body.event;
    const data = body.data;
    const instance = body.instance;

    // Detailed logging for ALL webhook events
    console.log("[webhook] INCOMING:", JSON.stringify({
      event,
      instance,
      remoteJid: data?.key?.remoteJid,
      fromMe: data?.key?.fromMe,
      hasMessage: !!data?.message,
      messageKeys: data?.message ? Object.keys(data.message) : [],
      stubType: data?.messageStubType,
      messageTimestamp: data?.messageTimestamp,
    }));

    if (event === "messages.update" && data) {
      try {
        await handleMessageStatusUpdate(data, instance);
      } catch (e: any) {
        console.error("Status update error (non-fatal):", e.message);
      }
      return res.json({ ok: true, statusUpdated: true });
    }

    if (!["messages.upsert", "send.message"].includes(event) || !data) {
      return res.json({ ok: true, skipped: event });
    }

    // Handle messages with messageStubType (protocol messages, undecrypted, etc.)
    // These may not have message content but we still want to create/update the conversation
    const hasStubType = !!data.messageStubType;
    const hasNoMessage = !data.message || Object.keys(data.message).length === 0;
    const isStubOnly = hasStubType && hasNoMessage;
    
    if (isStubOnly) {
      console.log(`[webhook] Stub-only message (stubType=${data.messageStubType}), ensuring conversation exists`);
    }

    const key = data.key || {};
    let remoteJid = key.remoteJid || data.remoteJid;
    const fromMe = key.fromMe ?? data.fromMe ?? false;

    // Resolve @lid: try to find the real phone number but KEEP remote_jid as-is
    let resolvedPhone: string | null = null;
    const originalLid = remoteJid;
    let lidValue: string | null = null;

    if (remoteJid && remoteJid.includes("@lid")) {
      lidValue = remoteJid;
      const senderPn = key.senderPn || data.senderPn;
      if (senderPn) {
        resolvedPhone = senderPn;
        console.log(`[webhook] Resolved phone via senderPn for @lid: ${resolvedPhone}`);
      } else if (key.remoteJidAlt && key.remoteJidAlt.includes("@s.whatsapp.net")) {
        resolvedPhone = key.remoteJidAlt.split("@")[0];
        console.log(`[webhook] Resolved phone via remoteJidAlt for @lid: ${resolvedPhone}`);
      } else if (key.participantAlt && key.participantAlt.includes("@s.whatsapp.net")) {
        resolvedPhone = key.participantAlt.split("@")[0];
        console.log(`[webhook] Resolved phone via participantAlt for @lid: ${resolvedPhone}`);
      } else {
        console.log(`[webhook] Could not resolve phone for @lid ${remoteJid}`);
      }
    } else if (remoteJid && remoteJid.includes("@s.whatsapp.net")) {
      resolvedPhone = remoteJid.split("@")[0];
    }

    // Smart lookup: find existing conversation by lid or phone_number (NEVER change remote_jid)
    let existingConvId: string | null = null;

    if (remoteJid.includes("@s.whatsapp.net") || remoteJid.includes("@lid")) {
      const supabaseLookup = getServiceClient();
      const { data: instRec } = await supabaseLookup
        .from("whatsapp_instances")
        .select("user_id")
        .eq("instance_name", instance)
        .limit(1)
        .single();

      if (instRec) {
        if (remoteJid.includes("@lid")) {
          // Message is @lid: find existing conv by lid
          const { data: lidConv } = await supabaseLookup
            .from("conversations")
            .select("id")
            .eq("user_id", instRec.user_id)
            .eq("lid", remoteJid)
            .eq("instance_name", instance)
            .limit(1)
            .maybeSingle();

          if (lidConv) {
            existingConvId = lidConv.id;
            console.log(`[webhook] Found existing conv by lid=${remoteJid}, conv=${lidConv.id}`);
          }
        } else if (resolvedPhone) {
          // Message is @s.whatsapp.net: find existing conv by phone_number (may be @lid conv)
          const { data: phoneConv } = await supabaseLookup
            .from("conversations")
            .select("id, remote_jid")
            .eq("user_id", instRec.user_id)
            .eq("phone_number", resolvedPhone)
            .eq("instance_name", instance)
            .limit(1)
            .maybeSingle();

          if (phoneConv) {
            existingConvId = phoneConv.id;
            console.log(`[webhook] Found existing conv by phone=${resolvedPhone}, conv=${phoneConv.id} (remote_jid=${phoneConv.remote_jid})`);
          }
        }
      }
    }

    // Skip group messages
    if (remoteJid && remoteJid.includes("@g.us")) {
      return res.json({ ok: true, skipped: "group" });
    }

    // Get supabase client and user info
    const supabase = getServiceClient();

    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("user_id")
      .eq("instance_name", instance)
      .limit(1)
      .single();

    if (!inst) {
      console.error("No instance found for:", instance);
      return res.status(404).json({ error: "Instance not found" });
    }

    const userId = inst.user_id;

    // Extract message content
    const message = data.message || {};
    const messageContent = message.conversation
      || message.extendedTextMessage?.text
      || message.imageMessage?.caption
      || message.videoMessage?.caption
      || message.documentMessage?.caption
      || "";
    const externalId = data.key?.id || data.messageId || null;

    // Determine message type
    let messageType = "text";
    if (message.imageMessage) messageType = "image";
    else if (message.videoMessage) messageType = "video";
    else if (message.audioMessage) messageType = "audio";
    else if (message.documentMessage) messageType = "document";
    else if (message.stickerMessage) messageType = "sticker";

    // Detect empty inbound messages (undecrypted) and apply placeholder
    const isEmptyInbound = !fromMe && !messageContent.trim() && messageType === "text";
    const finalContent = isEmptyInbound
      ? "Não foi possível visualizar a mensagem, abra seu smartphone para sincronizar"
      : messageContent;

    const lastMessagePreview = truncate(finalContent || `[${messageType}]`, 100);

    if (fromMe && event === "send.message") {
      if (existingConvId) {
        // Update existing conv (found by lid or phone_number)
        const updateData: Record<string, unknown> = {
          last_message: lastMessagePreview,
          last_message_at: new Date().toISOString(),
        };
        if (resolvedPhone) updateData.phone_number = resolvedPhone;
        if (lidValue) updateData.lid = lidValue;
        await supabase.from("conversations").update(updateData).eq("id", existingConvId);
      } else {
        const sendUpsert: Record<string, unknown> = {
          user_id: userId,
          remote_jid: remoteJid,
          last_message: lastMessagePreview,
          last_message_at: new Date().toISOString(),
          instance_name: instance,
        };
        if (resolvedPhone) sendUpsert.phone_number = resolvedPhone;
        if (lidValue) sendUpsert.lid = lidValue;
        await supabase
          .from("conversations")
          .upsert(sendUpsert, { onConflict: "user_id,remote_jid,instance_name" });
      }
      return res.json({ ok: true, updated: "conversation" });
    }

    if (fromMe && event === "messages.upsert" && externalId) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("external_id", externalId)
        .limit(1);
      if (existing && existing.length > 0) {
        console.log("Outbound message already saved by proxy, skipping:", externalId);
        return res.json({ ok: true, skipped: "already_saved" });
      }
    }

    let mediaUrl: string | null = null;
    if (messageType !== "text") {
      mediaUrl = await downloadAndUploadMedia(instance, data, messageType, userId);
      console.log("Media uploaded:", mediaUrl ? "success" : "failed/skipped");
    }

    const contactName = !fromMe ? (data.pushName || null) : null;

    let conv: { id: string } | null = null;
    let convError: any = null;

    if (existingConvId) {
      // Update existing conv found by lid or phone_number
      const updateData: Record<string, unknown> = {
        last_message: lastMessagePreview,
        last_message_at: new Date().toISOString(),
      };
      if (contactName) updateData.contact_name = contactName;
      if (resolvedPhone) updateData.phone_number = resolvedPhone;
      if (lidValue) updateData.lid = lidValue;

      const { error } = await supabase.from("conversations").update(updateData).eq("id", existingConvId);
      conv = { id: existingConvId };
      convError = error;
    } else {
      // No existing conv found — upsert with remote_jid as-is
      const upsertData: Record<string, unknown> = {
        user_id: userId,
        remote_jid: remoteJid,
        last_message: lastMessagePreview,
        last_message_at: new Date().toISOString(),
        instance_name: instance,
      };
      if (contactName) upsertData.contact_name = contactName;
      if (resolvedPhone) upsertData.phone_number = resolvedPhone;
      if (lidValue) upsertData.lid = lidValue;

      const { data: upserted, error } = await supabase
        .from("conversations")
        .upsert(upsertData, { onConflict: "user_id,remote_jid,instance_name" })
        .select("id")
        .single();
      conv = upserted;
      convError = error;
    }

    if (convError || !conv) {
      console.error("Failed to upsert conversation:", convError?.message || "no data returned");
      return res.status(500).json({ error: "Failed to save conversation" });
    }

    if (!fromMe) {
      await supabase.rpc("increment_unread", { conv_id: conv.id });
    }

    console.log("Inserting message:", { remoteJid, direction: fromMe ? "outbound" : "inbound", content: messageContent?.substring(0, 50), mediaUrl });
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      remote_jid: remoteJid,
      content: finalContent,
      message_type: messageType,
      direction: fromMe ? "outbound" : "inbound",
      status: "received",
      external_id: externalId,
      media_url: mediaUrl,
    });
    if (insertError) {
      console.error("Message insert error:", insertError.message, insertError);
    }

    let flowResumed = false;
    if (!fromMe && messageContent) {
      try {
        flowResumed = await checkAndResumeWaitingReply(supabase, userId, remoteJid, conv.id, instance);
      } catch (resumeErr: any) {
        console.error("Resume waiting_reply error (non-fatal):", resumeErr);
      }
    }

    let flowTriggered = false;
    if (!fromMe && messageContent && !flowResumed) {
      try {
        flowTriggered = await checkAndTriggerFlows(supabase, userId, remoteJid, messageContent, conv.id, instance, resolvedPhone);
      } catch (triggerErr: any) {
        console.error("Flow trigger error (non-fatal):", triggerErr);
      }
    }

    // AI Auto-Reply: only if no flow was resumed or triggered
    if (!fromMe && messageContent && !flowResumed && !flowTriggered) {
      try {
        await checkAndAutoReply(supabase, userId, remoteJid, conv.id, instance, messageContent);
      } catch (aiErr: any) {
        console.error("AI auto-reply error (non-fatal):", aiErr);
      }
    }

    // AI Listen: runs independently — analyzes messages for reminders
    if (!fromMe && messageContent) {
      try {
        await checkAndAutoListen(supabase, userId, remoteJid, conv.id, instance, messageContent, contactName);
      } catch (listenErr: any) {
        console.error("AI listen error (non-fatal):", listenErr);
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
});

async function checkAndTriggerFlows(
  supabase: any, userId: string, remoteJid: string, messageContent: string, conversationId: string, instanceName: string, resolvedPhone: string | null
): Promise<boolean> {
  const { data: flows, error: flowsErr } = await supabase
    .from("chatbot_flows")
    .select("id, nodes, instance_names")
    .eq("user_id", userId)
    .eq("active", true);

  if (flowsErr || !flows || flows.length === 0) return false;
  let triggered = false;

  const contentLower = messageContent.trim().toLowerCase();

  for (const flow of flows) {
    const nodes = (flow.nodes || []) as any[];
    let matched = false;

    for (const node of nodes) {
      const data = node.data || {};
      if (data.type === "trigger" && data.triggerKeyword) {
        const keyword = data.triggerKeyword.trim().toLowerCase();
        if (keyword && contentLower === keyword) { matched = true; break; }
      }
      if ((data.type === "group" || data.type === "groupBlock") && data.steps) {
        for (const step of data.steps) {
          if (step.data?.type === "trigger" && step.data?.triggerKeyword) {
            const keyword = step.data.triggerKeyword.trim().toLowerCase();
            if (keyword && contentLower === keyword) { matched = true; break; }
          }
        }
        if (matched) break;
      }
    }

    if (!matched) continue;

    const allowedInstances = (flow as any).instance_names || [];
    if (allowedInstances.length > 0 && !allowedInstances.includes(instanceName)) {
      console.log(`Flow ${flow.id} not allowed for instance ${instanceName}, skipping`);
      continue;
    }

    const { data: existing } = await supabase
      .from("flow_executions")
      .select("id")
      .eq("user_id", userId)
      .eq("flow_id", flow.id)
      .eq("remote_jid", remoteJid)
      .in("status", ["running", "waiting_click", "waiting_reply"])
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Flow ${flow.id} already active for ${remoteJid}, skipping`);
      continue;
    }

    console.log(`Triggering flow ${flow.id} for ${remoteJid} (keyword match)`);
    triggered = true;
    const backendUrl = `http://localhost:${process.env.PORT || 3001}`;

    fetch(`${backendUrl}/api/execute-flow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ flowId: flow.id, remoteJid, conversationId, userId, instanceName, resolvedPhone }),
    })
      .then(r => r.json())
      .then(r => console.log(`Flow ${flow.id} trigger result:`, r))
      .catch(e => console.error(`Flow ${flow.id} call error:`, e));
  }
  return triggered;
}

async function checkAndResumeWaitingReply(
  supabase: any, userId: string, remoteJid: string, conversationId: string, instanceName: string
): Promise<boolean> {
  let query = supabase
    .from("flow_executions")
    .select("id, flow_id, waiting_node_id")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .eq("status", "waiting_reply");

  if (instanceName) {
    query = query.eq("instance_name", instanceName);
  }

  const { data: waitingExecs } = await query.order("created_at", { ascending: false }).limit(1);

  if (!waitingExecs || waitingExecs.length === 0) return false;

  const exec = waitingExecs[0];
  const waitingNodeId = exec.waiting_node_id;
  console.log(`[webhook] Contact ${remoteJid} replied, resuming execution ${exec.id}, waiting_node_id=${waitingNodeId}`);

  await supabase.from("flow_timeouts").update({ processed: true }).eq("execution_id", exec.id).eq("processed", false);
  await supabase.from("flow_executions").update({ status: "completed" }).eq("id", exec.id);

  if (!waitingNodeId) {
    console.log(`[webhook] No waiting_node_id stored for execution ${exec.id}, cannot resume`);
    return true;
  }

  const { data: flow } = await supabase.from("chatbot_flows").select("edges").eq("id", exec.flow_id).single();
  if (!flow) return true;

  const edges = (flow.edges || []) as any[];
  const normalEdge = edges.find((e: any) => e.source === waitingNodeId && (e.sourceHandle === "output-0" || !e.sourceHandle));
  if (!normalEdge) {
    console.log(`[webhook] No next node found for waiting_node_id=${waitingNodeId}`);
    return true;
  }

  const nextNodeId = normalEdge.target;
  const backendUrl = `http://localhost:${process.env.PORT || 3001}`;

  fetch(`${backendUrl}/api/execute-flow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ flowId: exec.flow_id, remoteJid, conversationId, userId, resumeFromNodeId: nextNodeId, instanceName }),
  })
    .then(r => r.json())
    .then(r => console.log(`[webhook] Resume waiting_reply result:`, r))
    .catch(e => console.error(`[webhook] Resume waiting_reply error:`, e));

  return true;
}

async function handleMessageStatusUpdate(data: any, instance: string) {
  const supabase = getServiceClient();
  const updates = Array.isArray(data) ? data : [data];

  for (const update of updates) {
    const key = update.key || (update.keyId ? { id: update.keyId } : null);
    const externalId = key?.id || update.key?.id;
    const status = update.status;
    if (!externalId || !status) continue;

    const statusMap: Record<string, string> = {
      "DELIVERY_ACK": "delivered", "READ": "read", "PLAYED": "read",
      "SERVER_ACK": "sent", "ERROR": "error",
      "2": "delivered", "3": "read", "4": "read", "1": "sent", "0": "error",
    };
    const mappedStatus = statusMap[String(status)] || String(status).toLowerCase();

    const { error } = await supabase.from("messages").update({ status: mappedStatus }).eq("external_id", externalId);
    if (error) {
      console.error(`Failed to update status for ${externalId}:`, error.message);
    } else {
      console.log(`Message ${externalId} status -> ${mappedStatus}`);
    }
  }
}

// ── AI Auto-Reply ──
async function checkAndAutoReply(
  supabase: any, userId: string, remoteJid: string, conversationId: string, instanceName: string, messageContent: string
) {
  // Check if AI reply is enabled for this contact
  const { data: aiReply } = await supabase
    .from("ai_auto_reply_contacts")
    .select("id, enabled")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .eq("enabled", true)
    .maybeSingle();

  if (!aiReply) return;

  // Double-check no active flow
  const { data: activeFlows } = await supabase
    .from("flow_executions")
    .select("id")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .in("status", ["running", "waiting", "waiting_click", "waiting_reply"])
    .limit(1);

  if (activeFlows && activeFlows.length > 0) {
    console.log(`[ai-reply] Skipping: active flow for ${remoteJid}`);
    return;
  }

  // Get user's OpenAI key and AI config
  const [profileRes, configRes] = await Promise.all([
    supabase.from("profiles").select("openai_api_key").eq("user_id", userId).single(),
    supabase.from("ai_config").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const openaiKey = profileRes.data?.openai_api_key;
  if (!openaiKey) {
    console.log(`[ai-reply] No OpenAI key for user ${userId}`);
    return;
  }

  const config = configRes.data || {};
  const systemPrompt = config.reply_system_prompt || "Você é um assistente de vendas profissional. Responda de forma objetiva e cordial.";
  const maxContext = config.max_context_messages || 10;

  // Fetch recent messages for context
  const { data: recentMsgs } = await supabase
    .from("messages")
    .select("content, direction, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(maxContext);

  const contextMessages = (recentMsgs || []).reverse().map((m: any) => ({
    role: m.direction === "inbound" ? "user" : "assistant",
    content: m.content || "",
  }));

  // Call OpenAI
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...contextMessages,
        ],
        max_tokens: 500,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error(`[ai-reply] OpenAI error ${openaiRes.status}:`, errText);
      return;
    }

    const completion = await openaiRes.json() as any;
    const reply = completion.choices?.[0]?.message?.content;
    if (!reply) return;

    // Send via Evolution API
    await evolutionRequest(`/message/sendText/${encodeURIComponent(instanceName)}`, "POST", {
      number: remoteJid.replace("@s.whatsapp.net", "").replace("@lid", ""),
      text: reply,
    });

    // Save outbound message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      remote_jid: remoteJid,
      content: reply,
      message_type: "text",
      direction: "outbound",
      status: "sent",
    });

    // Update conversation
    await supabase.from("conversations").update({
      last_message: truncate(reply, 100),
      last_message_at: new Date().toISOString(),
    }).eq("id", conversationId);

    console.log(`[ai-reply] Sent reply to ${remoteJid}`);
  } catch (e: any) {
    console.error(`[ai-reply] Error:`, e.message);
  }
}

// ── AI Listen (auto-create reminders) ──
async function checkAndAutoListen(
  supabase: any, userId: string, remoteJid: string, conversationId: string, instanceName: string, messageContent: string, contactName: string | null
) {
  // Check if AI listen is enabled for this contact
  const { data: aiListen } = await supabase
    .from("ai_listen_contacts")
    .select("id, enabled")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .eq("enabled", true)
    .maybeSingle();

  if (!aiListen) return;

  // Get user's OpenAI key and AI config
  const [profileRes, configRes] = await Promise.all([
    supabase.from("profiles").select("openai_api_key").eq("user_id", userId).single(),
    supabase.from("ai_config").select("listen_rules").eq("user_id", userId).maybeSingle(),
  ]);

  const openaiKey = profileRes.data?.openai_api_key;
  if (!openaiKey) return;

  const listenRules = configRes.data?.listen_rules || "Detecte menções a pagamentos, datas, prazos e promessas.";
  const phone = remoteJid.split("@")[0];
  const brasiliaDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const diasSemana = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const now = brasiliaDate.toISOString().replace("T", " ").slice(0, 16);
  const diaSemanaAtual = diasSemana[brasiliaDate.getUTCDay()];

  const systemPrompt = `Você é um analisador de mensagens de WhatsApp. Sua tarefa é analisar a mensagem do contato e determinar se ela contém informações relevantes para criar um lembrete.

Regras do usuário: ${listenRules}

REGRAS DE DATA E HORÁRIO:
- Agora é ${diaSemanaAtual}, ${now} (horário de Brasília, UTC-3).
- Quando o contato mencionar "dia X" (ex: "dia 12", "dia 5"): se o dia X do mês atual já passou, agende para o dia X do PRÓXIMO mês. Se ainda não passou, use o mês atual.
- Quando mencionar um dia da semana (ex: "segunda", "quarta", "sexta"): se esse dia da semana já passou nesta semana, agende para o mesmo dia da PRÓXIMA semana. Se ainda não passou, use esta semana.
- "semana que vem" = próxima semana.
- "mês que vem" = próximo mês.
- "amanhã" = dia seguinte ao atual.
- "hoje" = dia atual.
- Quando o contato mencionar horários como "6 da tarde", "3 da manhã", "10h", interprete literalmente no horário de Brasília. Exemplos: "6 da tarde" = 18:00, "3 da tarde" = 15:00, "meio-dia" = 12:00, "6 da manhã" = 06:00.
- Sempre use horário comercial (09:00 Brasília) quando o contato NÃO especificar horário.
- IMPORTANTE: Todas as datas/horas retornadas em due_date devem estar em UTC (ISO 8601). Converta de Brasília para UTC somando 3 horas. Exemplo: 18:00 Brasília = 21:00 UTC.
- NUNCA gere uma due_date no passado. Se o cálculo resultar em data/hora passada, avance para o próximo período (próximo dia, próxima semana ou próximo mês).
- Se não houver data específica mencionada, use amanhã às 09:00 Brasília (= 12:00 UTC).

Se a mensagem contiver algo relevante, responda usando a ferramenta create_reminder.
Se NÃO houver nada relevante, responda usando a ferramenta no_action.

Contexto: Contato ${contactName || phone} (${phone}), instância ${instanceName}.`;

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_reminder",
              description: "Cria um lembrete quando a mensagem contém informação relevante",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título curto do lembrete" },
                  description: { type: "string", description: "Descrição detalhada" },
                  due_date: { type: "string", description: "Data/hora do lembrete em ISO 8601. Se não houver data específica, use amanhã às 9h." },
                },
                required: ["title", "due_date"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function",
            function: {
              name: "no_action",
              description: "Nenhuma ação necessária — mensagem não contém informação relevante",
              parameters: { type: "object", properties: {}, additionalProperties: false },
            },
          },
        ],
        tool_choice: "required",
      }),
    });

    if (!openaiRes.ok) {
      console.error(`[ai-listen] OpenAI error ${openaiRes.status}`);
      return;
    }

    const completion = await openaiRes.json() as any;
    const toolCall = completion.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "create_reminder") return;

    const args = JSON.parse(toolCall.function.arguments);
    
    await supabase.from("reminders").insert({
      user_id: userId,
      title: args.title,
      description: args.description || null,
      due_date: args.due_date,
      remote_jid: remoteJid,
      phone_number: phone,
      contact_name: contactName || null,
      instance_name: instanceName,
    });

    console.log(`[ai-listen] Created reminder for ${remoteJid}: ${args.title}`);
  } catch (e: any) {
    console.error(`[ai-listen] Error:`, e.message);
  }
}

export default router;
