import { Router } from "express";
import { getServiceClient, getAnonClient, SERVICE_ROLE_KEY } from "../lib/supabase";
import { getMessageQueue } from "../lib/message-queue";
import crypto from "crypto";

const router = Router();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGreetingBrasilia(): string {
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brasiliaHour >= 5 && brasiliaHour < 12) return "Bom dia";
  if (brasiliaHour >= 12 && brasiliaHour < 18) return "Boa tarde";
  return "Boa noite";
}

function resolveVariables(text: string): string {
  return text.replace(/\{\{saudacao\}\}/gi, getGreetingBrasilia());
}

interface StepData {
  type: string;
  textContent?: string;
  mediaUrl?: string;
  caption?: string;
  audioUrl?: string;
  delaySeconds?: number;
  steps?: { id: string; data: StepData }[];
  [key: string]: unknown;
}

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

async function executeStep(
  stepData: StepData, instanceName: string, jid: string, serviceClient: any, userId: string, sendNumber?: string
): Promise<string> {
  const num = sendNumber || jid;
  const nodeType = stepData.type;

  if (nodeType === "trigger") return "trigger: skipped";

  if (nodeType === "sendText" && stepData.textContent) {
    const resolvedText = resolveVariables(stepData.textContent);
    const queue = getMessageQueue(instanceName);
    const r = await queue.enqueue(() => evolutionRequest(`/message/sendText/${instanceName}`, "POST", { number: num, text: resolvedText }), `sendText→${num}`);
    console.log(`[execute-flow] sendText response:`, JSON.stringify(r));
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert({ user_id: userId, remote_jid: jid, last_message: resolvedText.substring(0, 50), last_message_at: new Date().toISOString(), instance_name: instanceName }, { onConflict: "user_id,remote_jid,instance_name" })
      .select("id").single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id, user_id: userId, remote_jid: jid, content: resolvedText,
        message_type: "text", direction: "outbound", status: "sent", external_id: r?.key?.id || null,
      });
    }
    return "sendText: ok";
  }

  if (nodeType === "sendImage" && stepData.mediaUrl) {
    const r = await evolutionRequest(`/message/sendMedia/${instanceName}`, "POST", { number: num, mediatype: "image", media: stepData.mediaUrl, caption: stepData.caption || "" });
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert({ user_id: userId, remote_jid: jid, last_message: stepData.caption || "[imagem]", last_message_at: new Date().toISOString(), instance_name: instanceName }, { onConflict: "user_id,remote_jid,instance_name" })
      .select("id").single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id, user_id: userId, remote_jid: jid, content: stepData.caption || "",
        message_type: "image", direction: "outbound", status: "sent", external_id: r?.key?.id || null, media_url: stepData.mediaUrl,
      });
    }
    return "sendImage: ok";
  }

  if (nodeType === "sendAudio" && stepData.audioUrl) {
    const r = await evolutionRequest(`/message/sendWhatsAppAudio/${instanceName}`, "POST", { number: num, audio: stepData.audioUrl });
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert({ user_id: userId, remote_jid: jid, last_message: "[áudio]", last_message_at: new Date().toISOString(), instance_name: instanceName }, { onConflict: "user_id,remote_jid,instance_name" })
      .select("id").single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id, user_id: userId, remote_jid: jid, content: "",
        message_type: "audio", direction: "outbound", status: "sent", external_id: r?.key?.id || null, media_url: stepData.audioUrl,
      });
    }
    return "sendAudio: ok";
  }

  if (nodeType === "sendVideo" && stepData.mediaUrl) {
    const r = await evolutionRequest(`/message/sendMedia/${instanceName}`, "POST", { number: num, mediatype: "video", media: stepData.mediaUrl, caption: stepData.caption || "" });
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert({ user_id: userId, remote_jid: jid, last_message: stepData.caption || "[vídeo]", last_message_at: new Date().toISOString(), instance_name: instanceName }, { onConflict: "user_id,remote_jid,instance_name" })
      .select("id").single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id, user_id: userId, remote_jid: jid, content: stepData.caption || "",
        message_type: "video", direction: "outbound", status: "sent", external_id: r?.key?.id || null, media_url: stepData.mediaUrl,
      });
    }
    return "sendVideo: ok";
  }

  if (nodeType === "sendFile" && (stepData as any).fileUrl) {
    let fileName = (stepData as any).fileName || "documento.pdf";
    if (!fileName.toLowerCase().endsWith(".pdf")) fileName += ".pdf";
    const r = await evolutionRequest(`/message/sendMedia/${instanceName}`, "POST", { number: num, mediatype: "document", media: (stepData as any).fileUrl, fileName, mimetype: "application/pdf" });
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert({ user_id: userId, remote_jid: jid, last_message: `[${fileName}]`, last_message_at: new Date().toISOString(), instance_name: instanceName }, { onConflict: "user_id,remote_jid,instance_name" })
      .select("id").single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id, user_id: userId, remote_jid: jid, content: fileName,
        message_type: "document", direction: "outbound", status: "sent", external_id: r?.key?.id || null, media_url: (stepData as any).fileUrl,
      });
    }
    return "sendFile: ok";
  }

  if (nodeType === "waitDelay") {
    let delaySec: number;
    if ((stepData as any).delayRandomMode && (stepData as any).delayMinSeconds != null && (stepData as any).delayMaxSeconds != null) {
      delaySec = (stepData as any).delayMinSeconds + Math.random() * ((stepData as any).delayMaxSeconds - (stepData as any).delayMinSeconds);
    } else {
      delaySec = stepData.delaySeconds || 3;
    }

    const presenceType = (stepData as any).delayPresenceType;
    if (presenceType === "composing" || presenceType === "recording" || (stepData as any).simulateTyping) {
      const presence = presenceType === "recording" ? "recording" : "composing";
      try {
        await evolutionRequest(`/message/sendPresence/${instanceName}`, "POST", { number: num, presence });
      } catch (e: any) {
        console.log(`[execute-flow] sendPresence error:`, e);
      }
    }

    await sleep(Math.min(delaySec * 1000, 30000));

    if (presenceType === "composing" || presenceType === "recording" || (stepData as any).simulateTyping) {
      try {
        await evolutionRequest(`/message/sendPresence/${instanceName}`, "POST", { number: num, presence: "paused" });
      } catch (e: any) {
        console.log(`[execute-flow] sendPresence paused error:`, e);
      }
    }

    return `waitDelay: ${delaySec.toFixed(1)}s`;
  }

  if (nodeType === "aiAgent") return "aiAgent: handled-externally";

  return `${nodeType}: no-op`;
}

router.post("/", async (req, res) => {
  const serviceClient = getServiceClient();
  let executionId: string | null = null;

  try {
    const authHeader = req.headers["authorization"] as string;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === SERVICE_ROLE_KEY;

    const { flowId, remoteJid, conversationId, userId: bodyUserId, resumeFromNodeId, instanceName: bodyInstanceName, resolvedPhone: bodyResolvedPhone } = req.body;

    let userId: string;
    if (isServiceRole && bodyUserId) {
      userId = bodyUserId;
    } else {
      const gotrueUrl = process.env.GOTRUE_URL || "http://gotrue:9999";
      const userResp = await fetch(`${gotrueUrl}/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userResp.ok) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userData: any = await userResp.json();
      userId = userData.id;
    }

    if (!flowId || !remoteJid) {
      return res.status(400).json({ error: "flowId and remoteJid required" });
    }

    const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;

    // Resolve sendNumber: if jid is @lid, use phone_number for Evolution API calls
    let sendNumber = jid;
    if (jid.includes("@lid")) {
      if (bodyResolvedPhone) {
        sendNumber = bodyResolvedPhone.includes("@") ? bodyResolvedPhone : `${bodyResolvedPhone}@s.whatsapp.net`;
        console.log(`[execute-flow] Using resolvedPhone from webhook: ${sendNumber}`);
      }
      // Will also try conversation lookup below
    }

    let instanceName = bodyInstanceName;
    if (!instanceName) {
      const { data: activeInst } = await serviceClient
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .single();
      instanceName = activeInst?.instance_name;
    }

    const [flowResult, profileResult, activeExecsResult] = await Promise.all([
      serviceClient.from("chatbot_flows").select("*").eq("id", flowId).eq("user_id", userId).single(),
      serviceClient.from("profiles").select("openai_api_key, app_public_url").eq("user_id", userId).single(),
      !resumeFromNodeId
        ? serviceClient.from("flow_executions").select("id").eq("user_id", userId).eq("remote_jid", jid).in("status", ["running", "waiting_click", "waiting_reply"]).limit(1)
        : Promise.resolve({ data: null }),
    ]);

    const { data: flow, error: flowErr } = flowResult;
    if (flowErr || !flow) return res.status(404).json({ error: "Flow not found" });

    const { data: profile } = profileResult;

    if (!instanceName) {
      return res.status(400).json({ error: "No instance name" });
    }

    if (!resumeFromNodeId) {
      let activeExecs = activeExecsResult.data;
      if (activeExecs && activeExecs.length > 0 && instanceName) {
        const { data: filteredExecs } = await serviceClient
          .from("flow_executions").select("id").eq("user_id", userId).eq("remote_jid", jid)
          .eq("instance_name", instanceName).in("status", ["running", "waiting_click", "waiting_reply"]).limit(1);
        activeExecs = filteredExecs;
      }
      if (activeExecs && activeExecs.length > 0) {
        return res.status(409).json({ ok: false, error: "active_flow_exists" });
      }
    }

    let resolvedConversationId = conversationId || null;
    if (!resolvedConversationId && jid && instanceName) {
      const { data: convLookup } = await serviceClient
        .from("conversations").select("id, phone_number").eq("user_id", userId).eq("remote_jid", jid)
        .eq("instance_name", instanceName).limit(1).single();
      if (convLookup) {
        resolvedConversationId = convLookup.id;
        // If sendNumber is still @lid, try to resolve from conversation phone_number
        if (sendNumber.includes("@lid") && convLookup.phone_number) {
          sendNumber = convLookup.phone_number.includes("@") ? convLookup.phone_number : `${convLookup.phone_number}@s.whatsapp.net`;
          console.log(`[execute-flow] Resolved sendNumber from conversation phone_number: ${sendNumber}`);
        }
      }
    }

    // Also try lookup by lid if still unresolved
    if (sendNumber.includes("@lid") && instanceName) {
      const { data: lidConv } = await serviceClient
        .from("conversations").select("phone_number").eq("user_id", userId).eq("lid", jid)
        .eq("instance_name", instanceName).limit(1).maybeSingle();
      if (lidConv?.phone_number) {
        sendNumber = lidConv.phone_number.includes("@") ? lidConv.phone_number : `${lidConv.phone_number}@s.whatsapp.net`;
        console.log(`[execute-flow] Resolved sendNumber from lid lookup: ${sendNumber}`);
      }
    }

    if (sendNumber.includes("@lid")) {
      console.error(`[execute-flow] WARN: Could not resolve phone for @lid ${jid}, messages will likely fail`);
    }

    console.log(`[execute-flow] sendNumber=${sendNumber}, jid=${jid}`);

    console.log(`[execute-flow] Starting flow ${flowId} for ${jid}`);

    const { data: execution, error: execErr } = await serviceClient
      .from("flow_executions")
      .insert({ user_id: userId, conversation_id: resolvedConversationId, flow_id: flowId, remote_jid: jid, status: "running", instance_name: instanceName || null })
      .select("id").single();

    if (execErr || !execution) return res.status(500).json({ error: "Failed to start execution tracking" });
    executionId = execution.id;

    const nodes = (flow.nodes || []) as any[];
    const edges = (flow.edges || []) as any[];

    const outgoingMap = new Map<string, string[]>();
    const timeoutEdgeMap = new Map<string, string>();
    const conditionEdgeMap = new Map<string, { trueTarget: string | null; falseTarget: string | null }>();

    for (const edge of edges) {
      if (edge.sourceHandle === "output-1") {
        timeoutEdgeMap.set(edge.source, edge.target);
      } else {
        if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
        outgoingMap.get(edge.source)!.push(edge.target);
      }
    }

    for (const node of nodes) {
      const data = node.data || {};
      if (data.type === "condition") {
        const trueEdge = edges.find((e: any) => e.source === node.id && e.sourceHandle === "output-0");
        const falseEdge = edges.find((e: any) => e.source === node.id && e.sourceHandle === "output-1");
        conditionEdgeMap.set(node.id, { trueTarget: trueEdge?.target || null, falseTarget: falseEdge?.target || null });
      }
    }

    const targetsSet = new Set(edges.map((e: any) => e.target));
    const sourcesSet = new Set(edges.map((e: any) => e.source));
    let startNodes: any[];

    if (resumeFromNodeId) {
      const resumeNode = nodes.find((n: any) => n.id === resumeFromNodeId);
      startNodes = resumeNode ? [resumeNode] : [];
    } else {
      // Prioridade 1: nós do tipo trigger (standalone ou dentro de groupBlock)
      startNodes = nodes.filter((n: any) => {
        const d = n.data || {};
        if (d.type === "trigger") return true;
        if (d.type === "groupBlock" && d.steps) {
          return d.steps.some((s: any) => s.data?.type === "trigger");
        }
        return false;
      });

      // Fallback: primeiro nó sem entrada que tenha pelo menos uma saída (conectado)
      if (startNodes.length === 0) {
        startNodes = nodes.filter((n: any) =>
          !targetsSet.has(n.id) && sourcesSet.has(n.id)
        );
        if (startNodes.length === 0 && nodes.length > 0) {
          startNodes.push(nodes[0]);
        }
      }
    }

    const visited = new Set<string>();
    const queue = [...startNodes];
    const results: string[] = [];
    let nodeIndex = 0;

    const backendUrl = `http://localhost:${process.env.PORT || 3001}`;
    const appUrl = process.env.APP_URL || "http://localhost";

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      if (nodeIndex > 0) {
        const { data: statusCheck } = await serviceClient.from("flow_executions").select("status").eq("id", executionId).single();
        if (statusCheck?.status === "cancelled" || statusCheck?.status === "paused") {
          results.push(`execution ${statusCheck.status} at node ${nodeIndex}`);
          break;
        }
      }

      await serviceClient.from("flow_executions").update({ current_node_index: nodeIndex }).eq("id", executionId);

      const data = node.data || {};
      const nodeType = data.type;
      console.log(`[execute-flow] Processing node ${node.id}, type: ${nodeType}`);

      try {
        if (nodeType === "condition") {
          const conditionEdges = conditionEdgeMap.get(node.id);
          let conditionResult = false;

          if (data.conditionOperator === "has_tag") {
            const tagName = (data.conditionValue || "").trim().toLowerCase();
            if (tagName) {
              const { data: tagRecord } = await serviceClient.from("contact_tags").select("id").eq("user_id", userId).eq("remote_jid", jid).ilike("tag_name", tagName).limit(1);
              conditionResult = !!(tagRecord && tagRecord.length > 0);
            }
          } else {
            const { data: lastMsg } = await serviceClient.from("messages").select("content").eq("remote_jid", jid).eq("user_id", userId).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1);
            const msgText = (lastMsg?.[0]?.content || "").toLowerCase();
            const condValue = (data.conditionValue || "").toLowerCase();

            switch (data.conditionOperator) {
              case "equals": conditionResult = msgText === condValue; break;
              case "contains": conditionResult = msgText.includes(condValue); break;
              case "starts_with": conditionResult = msgText.startsWith(condValue); break;
              case "regex": try { conditionResult = new RegExp(data.conditionValue || "", "i").test(msgText); } catch { conditionResult = false; } break;
              default: conditionResult = msgText.includes(condValue);
            }
          }

          results.push(`condition: ${conditionResult ? "true" : "false"}`);
          const targetId = conditionResult ? conditionEdges?.trueTarget : conditionEdges?.falseTarget;
          if (targetId) {
            const targetNode = nodes.find((n: any) => n.id === targetId);
            if (targetNode) queue.push(targetNode);
          }
          nodeIndex++;
          continue;
        }

        if (nodeType === "action") {
          const actionType = data.actionType || "add_tag";
          const actionValue = (data.actionValue || "").trim();
          if (actionType === "add_tag" && actionValue) {
            await serviceClient.from("contact_tags").upsert({ user_id: userId, remote_jid: jid, tag_name: actionValue.toLowerCase() }, { onConflict: "user_id,remote_jid,tag_name" });
            results.push(`action: add_tag "${actionValue}"`);
          } else if (actionType === "remove_tag" && actionValue) {
            await serviceClient.from("contact_tags").delete().eq("user_id", userId).eq("remote_jid", jid).ilike("tag_name", actionValue.toLowerCase());
            results.push(`action: remove_tag "${actionValue}"`);
          } else {
            results.push(`action: ${actionType} "${actionValue}" (no-op)`);
          }
        } else if (nodeType === "aiAgent") {
          const openaiKey = profile?.openai_api_key || process.env.OPENAI_API_KEY;
          if (!openaiKey) {
            results.push("aiAgent: error - OpenAI API Key não configurada");
          } else {
            const historyCount = data.aiHistoryCount || 10;
            const { data: historyMsgs } = await serviceClient.from("messages").select("content, direction, message_type, media_url").eq("remote_jid", jid).eq("user_id", userId).order("created_at", { ascending: false }).limit(historyCount);

            const openaiMessages: any[] = [];
            if (data.aiSystemPrompt) openaiMessages.push({ role: "system", content: data.aiSystemPrompt });

            const acceptedMedia = data.aiAcceptedMedia || ["text"];
            for (const msg of (historyMsgs || []).reverse()) {
              const role = msg.direction === "inbound" ? "user" : "assistant";
              if (msg.message_type === "text" && msg.content) {
                openaiMessages.push({ role, content: msg.content });
              } else if (msg.message_type === "image" && msg.media_url && acceptedMedia.includes("image")) {
                openaiMessages.push({ role, content: [{ type: "text", text: msg.content || "Imagem enviada" }, { type: "image_url", image_url: { url: msg.media_url } }] });
              } else if (msg.content) {
                openaiMessages.push({ role, content: msg.content });
              }
            }

            const aiModel = data.aiModel || "gpt-4o";
            const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: aiModel, messages: openaiMessages, temperature: data.aiTemperature ?? 0.7, max_tokens: data.aiMaxTokens || 500 }),
            });
            const aiData: any = await aiResp.json();
            const aiResponse = aiData?.choices?.[0]?.message?.content || "";

            if (data.aiAutoSend !== false && aiResponse) {
              const sendResult = await evolutionRequest(`/message/sendText/${instanceName}`, "POST", { number: sendNumber, text: aiResponse });
              const { data: conv } = await serviceClient.from("conversations").upsert({ user_id: userId, remote_jid: jid, last_message: aiResponse.substring(0, 50), last_message_at: new Date().toISOString(), instance_name: instanceName }, { onConflict: "user_id,remote_jid,instance_name" }).select("id").single();
              if (conv) {
                await serviceClient.from("messages").insert({ conversation_id: conv.id, user_id: userId, remote_jid: jid, content: aiResponse, message_type: "text", direction: "outbound", status: "sent", external_id: sendResult?.key?.id || null });
              }
            }
            results.push(`aiAgent: ok (${aiModel})`);
          }
        } else if (nodeType === "waitForClick") {
          const clickUrl = data.clickUrl;
          if (!clickUrl) { results.push("waitForClick: error - URL não configurada"); }
          else {
            const shortCode = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            const nextIds = outgoingMap.get(node.id) || [];
            const nextNodeId = nextIds.length > 0 ? nextIds[0] : null;

            await serviceClient.from("tracked_links").insert({
              user_id: userId, flow_id: flowId, execution_id: executionId, remote_jid: jid,
              original_url: clickUrl, short_code: shortCode, next_node_id: nextNodeId,
              conversation_id: conversationId || null, preview_title: data.clickPreviewTitle || null,
              preview_description: data.clickPreviewDescription || null, preview_image: data.clickPreviewImage || null,
              instance_name: instanceName,
            });

            const trackingUrl = `${appUrl}/r/${shortCode}`;
            const messageTemplate = data.clickMessage || "Acesse: {{link}}";
            const messageText = resolveVariables(messageTemplate.replace(/\{\{link\}\}/gi, trackingUrl));

            const sendResult = await evolutionRequest(`/message/sendText/${instanceName}`, "POST", { number: sendNumber, text: messageText });
            const { data: conv } = await serviceClient.from("conversations").upsert({ user_id: userId, remote_jid: jid, last_message: messageText.substring(0, 50), last_message_at: new Date().toISOString(), instance_name: instanceName }, { onConflict: "user_id,remote_jid,instance_name" }).select("id").single();
            if (conv) {
              await serviceClient.from("messages").insert({ conversation_id: conv.id, user_id: userId, remote_jid: jid, content: messageText, message_type: "text", direction: "outbound", status: "sent", external_id: sendResult?.key?.id || null });
            }

            await serviceClient.from("flow_executions").update({ status: "waiting_click", current_node_index: nodeIndex, waiting_node_id: node.id }).eq("id", executionId);

            const clickTimeout = data.clickTimeout || 0;
            if (clickTimeout > 0) {
              const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
              const unit = data.clickTimeoutUnit || "minutes";
              const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
              const timeoutAt = new Date(Date.now() + clickTimeout * multiplier).toISOString();
              await serviceClient.from("flow_timeouts").insert({ execution_id: executionId, flow_id: flowId, user_id: userId, remote_jid: jid, conversation_id: conversationId || null, timeout_node_id: timeoutNodeId, timeout_at: timeoutAt });
            }

            results.push(`waitForClick: paused (code=${shortCode})`);
            break;
          }
        } else if (nodeType === "waitForReply") {
          await serviceClient.from("flow_executions").update({ status: "waiting_reply", current_node_index: nodeIndex, waiting_node_id: node.id }).eq("id", executionId);

          const replyTimeout = data.replyTimeout || 0;
          if (replyTimeout > 0) {
            const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
            const unit = data.replyTimeoutUnit || "minutes";
            const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
            const timeoutAt = new Date(Date.now() + replyTimeout * multiplier).toISOString();
            await serviceClient.from("flow_timeouts").insert({ execution_id: executionId, flow_id: flowId, user_id: userId, remote_jid: jid, conversation_id: conversationId || null, timeout_node_id: timeoutNodeId, timeout_at: timeoutAt });
          }

          results.push(`waitForReply: paused`);
          break;
        } else if ((nodeType === "group" || nodeType === "groupBlock") && data.steps) {
          let groupPaused = false;
          for (let si = 0; si < data.steps.length; si++) {
            // Check cancellation before each group step
            const { data: groupStatusCheck } = await serviceClient.from("flow_executions").select("status").eq("id", executionId).single();
            if (groupStatusCheck?.status === "cancelled" || groupStatusCheck?.status === "paused") {
              results.push(`group: ${groupStatusCheck.status} at step ${si}`);
              groupPaused = true;
              break;
            }
            const step = data.steps[si];
            if (step.data.type === "waitForClick") {
              const clickUrl = step.data.clickUrl;
              if (!clickUrl) { results.push(`group.${step.id}: waitForClick: error`); continue; }
              const shortCode = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
              const nextNodeId = (outgoingMap.get(node.id) || [])[0] || null;

              await serviceClient.from("tracked_links").insert({
                user_id: userId, flow_id: flowId, execution_id: executionId, remote_jid: jid,
                original_url: clickUrl, short_code: shortCode, next_node_id: nextNodeId,
                conversation_id: conversationId || null, preview_title: step.data.clickPreviewTitle || null,
                preview_description: step.data.clickPreviewDescription || null, preview_image: step.data.clickPreviewImage || null,
                instance_name: instanceName,
              });

              const trackingUrl = `${appUrl}/r/${shortCode}`;
              const messageTemplate = step.data.clickMessage || "Acesse: {{link}}";
              const messageText = resolveVariables(messageTemplate.replace(/\{\{link\}\}/gi, trackingUrl));

              const sendResult = await evolutionRequest(`/message/sendText/${instanceName}`, "POST", { number: sendNumber, text: messageText });
              const { data: conv } = await serviceClient.from("conversations").upsert({ user_id: userId, remote_jid: jid, last_message: messageText.substring(0, 50), last_message_at: new Date().toISOString(), instance_name: instanceName }, { onConflict: "user_id,remote_jid,instance_name" }).select("id").single();
              if (conv) {
                await serviceClient.from("messages").insert({ conversation_id: conv.id, user_id: userId, remote_jid: jid, content: messageText, message_type: "text", direction: "outbound", status: "sent", external_id: sendResult?.key?.id || null });
              }

              await serviceClient.from("flow_executions").update({ status: "waiting_click", current_node_index: nodeIndex, waiting_node_id: node.id }).eq("id", executionId);

              const clickTimeout = step.data.clickTimeout || 0;
              if (clickTimeout > 0) {
                const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
                const unit = step.data.clickTimeoutUnit || "minutes";
                const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
                const timeoutAt = new Date(Date.now() + clickTimeout * multiplier).toISOString();
                await serviceClient.from("flow_timeouts").insert({ execution_id: executionId, flow_id: flowId, user_id: userId, remote_jid: jid, conversation_id: conversationId || null, timeout_node_id: timeoutNodeId, timeout_at: timeoutAt });
              }

              results.push(`group.${step.id}: waitForClick: paused`);
              groupPaused = true;
              break;
            } else if (step.data.type === "waitForReply") {
              await serviceClient.from("flow_executions").update({ status: "waiting_reply", current_node_index: nodeIndex, waiting_node_id: node.id }).eq("id", executionId);

              const replyTimeout = step.data.replyTimeout || 0;
              if (replyTimeout > 0) {
                const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
                const unit = step.data.replyTimeoutUnit || "minutes";
                const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
                const timeoutAt = new Date(Date.now() + replyTimeout * multiplier).toISOString();
                await serviceClient.from("flow_timeouts").insert({ execution_id: executionId, flow_id: flowId, user_id: userId, remote_jid: jid, conversation_id: conversationId || null, timeout_node_id: timeoutNodeId, timeout_at: timeoutAt });
              }

              results.push(`group.${step.id}: waitForReply: paused`);
              groupPaused = true;
              break;
            } else if (step.data.type === "action") {
              const actionType = step.data.actionType || "add_tag";
              const actionValue = (step.data.actionValue || "").trim();
              if (actionType === "add_tag" && actionValue) {
                await serviceClient.from("contact_tags").upsert({ user_id: userId, remote_jid: jid, tag_name: actionValue.toLowerCase() }, { onConflict: "user_id,remote_jid,tag_name" });
                results.push(`group.${step.id}: action: add_tag "${actionValue}"`);
              } else if (actionType === "remove_tag" && actionValue) {
                await serviceClient.from("contact_tags").delete().eq("user_id", userId).eq("remote_jid", jid).ilike("tag_name", actionValue.toLowerCase());
                results.push(`group.${step.id}: action: remove_tag "${actionValue}"`);
              }
            } else {
              const stepResult = await executeStep(step.data, instanceName, jid, serviceClient, userId, sendNumber);
              results.push(`group.${step.id}: ${stepResult}`);
            }
          }
          if (groupPaused) break;
        } else {
          const result = await executeStep(data, instanceName, jid, serviceClient, userId, sendNumber);
          results.push(result);
        }
      } catch (err: any) {
        results.push(`${nodeType}: error - ${err.message}`);
      }

      nodeIndex++;
      const nextIds = outgoingMap.get(node.id) || [];
      for (const nextId of nextIds) {
        const nextNode = nodes.find((n: any) => n.id === nextId);
        if (nextNode) queue.push(nextNode);
      }
    }

    console.log(`[execute-flow] Flow ${flowId} completed. Results:`, results);
    await serviceClient.from("flow_executions").update({ status: "completed" }).eq("id", executionId).eq("status", "running");

    return res.json({ ok: true, executed: results, executionId });
  } catch (err: any) {
    console.error("execute-flow error:", err);
    if (executionId) {
      await serviceClient.from("flow_executions").update({ status: "completed" }).eq("id", executionId);
    }
    return res.status(500).json({ error: err.message });
  }
});

export default router;
