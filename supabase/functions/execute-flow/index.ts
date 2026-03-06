import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGreetingBrasilia(): string {
  const now = new Date();
  // Brasília = UTC-3
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

async function executeStep(
  stepData: StepData,
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  jid: string,
  serviceClient: any,
  userId: string
): Promise<string> {
  const nodeType = stepData.type;

  if (nodeType === "trigger") {
    return "trigger: skipped";
  }

  if (nodeType === "sendText" && stepData.textContent) {
    const resolvedText = resolveVariables(stepData.textContent);
    const resp = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, text: resolvedText }),
    });
    const r = await resp.json();
    console.log(`[execute-flow] sendText response:`, JSON.stringify(r));
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert(
        { user_id: userId, remote_jid: jid, last_message: resolvedText.substring(0, 50), last_message_at: new Date().toISOString(), instance_name: instanceName },
        { onConflict: "user_id,remote_jid,instance_name" }
      )
      .select("id")
      .single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id,
        user_id: userId,
        remote_jid: jid,
        content: resolvedText,
        message_type: "text",
        direction: "outbound",
        status: "sent",
        external_id: r?.key?.id || null,
      });
    }
    return "sendText: ok";
  }

  if (nodeType === "sendImage" && stepData.mediaUrl) {
    const resp = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, mediatype: "image", media: stepData.mediaUrl, caption: stepData.caption || "" }),
    });
    const r = await resp.json();
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert(
        { user_id: userId, remote_jid: jid, last_message: stepData.caption || "[imagem]", last_message_at: new Date().toISOString(), instance_name: instanceName },
        { onConflict: "user_id,remote_jid,instance_name" }
      )
      .select("id")
      .single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id,
        user_id: userId,
        remote_jid: jid,
        content: stepData.caption || "",
        message_type: "image",
        direction: "outbound",
        status: "sent",
        external_id: r?.key?.id || null,
        media_url: stepData.mediaUrl,
      });
    }
    return "sendImage: ok";
  }

  if (nodeType === "sendAudio" && stepData.audioUrl) {
    const resp = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${instanceName}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, audio: stepData.audioUrl }),
    });
    const r = await resp.json();
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert(
        { user_id: userId, remote_jid: jid, last_message: "[áudio]", last_message_at: new Date().toISOString(), instance_name: instanceName },
        { onConflict: "user_id,remote_jid,instance_name" }
      )
      .select("id")
      .single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id,
        user_id: userId,
        remote_jid: jid,
        content: "",
        message_type: "audio",
        direction: "outbound",
        status: "sent",
        external_id: r?.key?.id || null,
        media_url: stepData.audioUrl,
      });
    }
    return "sendAudio: ok";
  }

  if (nodeType === "sendVideo" && stepData.mediaUrl) {
    const resp = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, mediatype: "video", media: stepData.mediaUrl, caption: stepData.caption || "" }),
    });
    const r = await resp.json();
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert(
        { user_id: userId, remote_jid: jid, last_message: stepData.caption || "[vídeo]", last_message_at: new Date().toISOString(), instance_name: instanceName },
        { onConflict: "user_id,remote_jid,instance_name" }
      )
      .select("id")
      .single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id,
        user_id: userId,
        remote_jid: jid,
        content: stepData.caption || "",
        message_type: "video",
        direction: "outbound",
        status: "sent",
        external_id: r?.key?.id || null,
        media_url: stepData.mediaUrl,
      });
    }
    return "sendVideo: ok";
  }

  if (nodeType === "sendFile" && stepData.fileUrl) {
    let fileName = (stepData as any).fileName || "documento.pdf";
    if (!fileName.toLowerCase().endsWith(".pdf")) fileName += ".pdf";
    const resp = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, mediatype: "document", media: stepData.fileUrl, fileName, mimetype: "application/pdf" }),
    });
    const r = await resp.json();
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert(
        { user_id: userId, remote_jid: jid, last_message: `[${fileName}]`, last_message_at: new Date().toISOString(), instance_name: instanceName },
        { onConflict: "user_id,remote_jid,instance_name" }
      )
      .select("id")
      .single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id,
        user_id: userId,
        remote_jid: jid,
        content: fileName,
        message_type: "document",
        direction: "outbound",
        status: "sent",
        external_id: r?.key?.id || null,
        media_url: stepData.fileUrl,
      });
    }
    return "sendFile: ok";
  }

  if (nodeType === "waitDelay") {
    let delaySec: number;
    if (stepData.delayRandomMode && stepData.delayMinSeconds != null && stepData.delayMaxSeconds != null) {
      const min = stepData.delayMinSeconds;
      const max = stepData.delayMaxSeconds;
      delaySec = min + Math.random() * (max - min);
    } else {
      delaySec = stepData.delaySeconds || 3;
    }

    // Send presence indicator (composing or recording)
    const presenceType = (stepData as any).delayPresenceType;
    if (presenceType === "composing" || presenceType === "recording" || stepData.simulateTyping) {
      const presence = presenceType === "recording" ? "recording" : "composing";
      try {
        await fetch(`${baseUrl}/message/sendPresence/${instanceName}`, {
          method: "POST",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: jid, presence }),
        });
      } catch (e) {
        console.log(`[execute-flow] sendPresence error:`, e);
      }
    }

    const delay = delaySec * 1000;
    await sleep(Math.min(delay, 30000));

    // Stop presence indicator
    const presenceTypeAfter = (stepData as any).delayPresenceType;
    if (presenceTypeAfter === "composing" || presenceTypeAfter === "recording" || stepData.simulateTyping) {
      try {
        await fetch(`${baseUrl}/message/sendPresence/${instanceName}`, {
          method: "POST",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: jid, presence: "paused" }),
        });
      } catch (e) {
        console.log(`[execute-flow] sendPresence paused error:`, e);
      }
    }

    return `waitDelay: ${delaySec.toFixed(1)}s`;
  }

  if (nodeType === "aiAgent") {
    // Handled separately in the main loop (needs serviceClient context for history)
    return "aiAgent: handled-externally";
  }

  return `${nodeType}: no-op`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let executionId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceRoleKey;

    const { flowId, remoteJid, conversationId, userId: bodyUserId, resumeFromNodeId, instanceName: bodyInstanceName } = await req.json();

    let userId: string;
    if (isServiceRole && bodyUserId) {
      userId = bodyUserId;
    } else {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub;
    }

    if (!flowId || !remoteJid) {
      return new Response(JSON.stringify({ error: "flowId and remoteJid required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;

    // Run all initial queries in parallel for faster startup
    const [flowResult, profileResult, activeInstanceResult, activeExecsResult] = await Promise.all([
      serviceClient
        .from("chatbot_flows")
        .select("*")
        .eq("id", flowId)
        .eq("user_id", userId)
        .single(),
      serviceClient
        .from("profiles")
        .select("openai_api_key, app_public_url")
        .eq("user_id", userId)
        .single(),
      // Get active instance if not provided in body
      !bodyInstanceName
        ? serviceClient
            .from("evolution_instances")
            .select("instance_name")
            .eq("user_id", userId)
            .eq("is_active", true)
            .limit(1)
            .single()
        : Promise.resolve({ data: { instance_name: bodyInstanceName } }),
      // Only check active executions if not resuming
      !resumeFromNodeId
        ? serviceClient
            .from("flow_executions")
            .select("id")
            .eq("user_id", userId)
            .eq("remote_jid", jid)
            .in("status", ["running", "waiting_click", "waiting_reply"])
            .limit(1)
        : Promise.resolve({ data: null }),
    ]);

    const { data: flow, error: flowErr } = flowResult;
    if (flowErr || !flow) {
      return new Response(JSON.stringify({ error: "Flow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = profileResult;

    // Baileys connection via env vars (backend handles routing)
    const baileysUrl = Deno.env.get("BAILEYS_URL") || "http://baileys:8084";
    const apiKey = Deno.env.get("BAILEYS_API_KEY") || "baileys-local-key";
    const instanceName = activeInstanceResult?.data?.instance_name || bodyInstanceName;
    if (!instanceName) {
      return new Response(JSON.stringify({ error: "Nenhuma instância WhatsApp ativa. Vincule uma instância nas configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const baseUrl = baileysUrl.replace(/\/$/, "");

    // Check active executions result (with instance_name filter if needed)
    if (!resumeFromNodeId) {
      let activeExecs = activeExecsResult.data;
      // If we need instance filtering, re-query only if we have results (rare path)
      if (activeExecs && activeExecs.length > 0 && instanceName) {
        const { data: filteredExecs } = await serviceClient
          .from("flow_executions")
          .select("id")
          .eq("user_id", userId)
          .eq("remote_jid", jid)
          .eq("instance_name", instanceName)
          .in("status", ["running", "waiting_click", "waiting_reply"])
          .limit(1);
        activeExecs = filteredExecs;
      }
      if (activeExecs && activeExecs.length > 0) {
        console.log(`[execute-flow] Blocked: active execution ${activeExecs[0].id} already exists for ${jid}`);
        return new Response(JSON.stringify({ ok: false, error: "active_flow_exists", message: "Já existe um fluxo ativo para este contato." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Auto-lookup conversation_id if not provided
    let resolvedConversationId = conversationId || null;
    if (!resolvedConversationId && jid && instanceName) {
      const { data: convLookup } = await serviceClient
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .eq("remote_jid", jid)
        .eq("instance_name", evolution_instance_name)
        .limit(1)
        .single();
      if (convLookup) {
        resolvedConversationId = convLookup.id;
        console.log(`[execute-flow] Auto-resolved conversation_id: ${resolvedConversationId}`);
      }
    }

    console.log(`[execute-flow] Starting flow ${flowId} for ${jid}`);

    const { data: execution, error: execErr } = await serviceClient
      .from("flow_executions")
      .insert({ user_id: userId, conversation_id: resolvedConversationId, flow_id: flowId, remote_jid: jid, status: "running", instance_name: evolution_instance_name || null })
      .select("id")
      .single();

    if (execErr || !execution) {
      console.error("Failed to create execution record:", execErr);
      return new Response(JSON.stringify({ error: "Failed to start execution tracking" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    executionId = execution.id;

    const nodes = (flow.nodes || []) as any[];
    const edges = (flow.edges || []) as any[];

    // Build outgoing map: nodeId -> [targetIds] (for default/output-0 handles)
    // Also build a separate map for timeout edges (output-1)
    const outgoingMap = new Map<string, string[]>();
    const timeoutEdgeMap = new Map<string, string>(); // sourceNodeId -> targetNodeId for timeout path
    const conditionEdgeMap = new Map<string, { trueTarget: string | null; falseTarget: string | null }>();
    for (const edge of edges) {
      if (edge.sourceHandle === "output-1") {
        // This is a timeout or "false" edge
        timeoutEdgeMap.set(edge.source, edge.target);
      } else {
        if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
        outgoingMap.get(edge.source)!.push(edge.target);
      }
    }

    // Build condition edge map for condition nodes
    for (const node of nodes) {
      const data = node.data || {};
      if (data.type === "condition") {
        const trueEdge = edges.find((e: any) => e.source === node.id && e.sourceHandle === "output-0");
        const falseEdge = edges.find((e: any) => e.source === node.id && e.sourceHandle === "output-1");
        conditionEdgeMap.set(node.id, {
          trueTarget: trueEdge?.target || null,
          falseTarget: falseEdge?.target || null,
        });
      }
    }

    const targetsSet = new Set(edges.map((e: any) => e.target));
    let startNodes: any[];

    if (resumeFromNodeId) {
      // Resume from a specific node (e.g. after waitForClick)
      const resumeNode = nodes.find((n: any) => n.id === resumeFromNodeId);
      startNodes = resumeNode ? [resumeNode] : [];
      console.log(`[execute-flow] Resuming from node ${resumeFromNodeId}`);
    } else {
      startNodes = nodes.filter((n: any) => !targetsSet.has(n.id));
      if (startNodes.length === 0 && nodes.length > 0) {
        startNodes.push(nodes[0]);
      }
    }

    const visited = new Set<string>();
    const queue = [...startNodes];
    const results: string[] = [];
    let nodeIndex = 0;

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      // Check cancellation every 3 nodes instead of every node to reduce DB calls
      if (nodeIndex > 0 && nodeIndex % 3 === 0) {
        const { data: statusCheck } = await serviceClient
          .from("flow_executions")
          .select("status")
          .eq("id", executionId)
          .single();

        if (statusCheck?.status === "cancelled" || statusCheck?.status === "paused") {
          results.push(`execution ${statusCheck.status} at node ${nodeIndex}`);
          break;
        }
      }

      await serviceClient
        .from("flow_executions")
        .update({ current_node_index: nodeIndex })
        .eq("id", executionId);

      const data = node.data || {};
      const nodeType = data.type;
      console.log(`[execute-flow] Processing node ${node.id}, type: ${nodeType}`);

      try {
        // === CONDITION NODE: evaluate and route ===
        if (nodeType === "condition") {
          const conditionEdges = conditionEdgeMap.get(node.id);
          let conditionResult = false;

          if (data.conditionOperator === "has_tag") {
            // Check if contact has the tag
            const tagName = (data.conditionValue || "").trim().toLowerCase();
            if (tagName) {
              const { data: tagRecord } = await serviceClient
                .from("contact_tags")
                .select("id")
                .eq("user_id", userId)
                .eq("remote_jid", jid)
                .ilike("tag_name", tagName)
                .limit(1);
              conditionResult = !!(tagRecord && tagRecord.length > 0);
            }
            console.log(`[execute-flow] Condition has_tag "${data.conditionValue}": ${conditionResult}`);
          } else {
            // Text-based conditions - get last inbound message
            const { data: lastMsg } = await serviceClient
              .from("messages")
              .select("content")
              .eq("remote_jid", jid)
              .eq("user_id", userId)
              .eq("direction", "inbound")
              .order("created_at", { ascending: false })
              .limit(1);
            const msgText = (lastMsg?.[0]?.content || "").toLowerCase();
            const condValue = (data.conditionValue || "").toLowerCase();

            switch (data.conditionOperator) {
              case "equals":
                conditionResult = msgText === condValue;
                break;
              case "contains":
                conditionResult = msgText.includes(condValue);
                break;
              case "starts_with":
                conditionResult = msgText.startsWith(condValue);
                break;
              case "regex":
                try { conditionResult = new RegExp(data.conditionValue || "", "i").test(msgText); } catch { conditionResult = false; }
                break;
              default:
                conditionResult = msgText.includes(condValue);
            }
            console.log(`[execute-flow] Condition ${data.conditionOperator} "${data.conditionValue}" on "${msgText.substring(0, 30)}": ${conditionResult}`);
          }

          results.push(`condition: ${conditionResult ? "true" : "false"}`);

          // Route to correct output
          const targetId = conditionResult ? conditionEdges?.trueTarget : conditionEdges?.falseTarget;
          if (targetId) {
            const targetNode = nodes.find((n: any) => n.id === targetId);
            if (targetNode) queue.push(targetNode);
          }
          nodeIndex++;
          continue; // Skip default outgoing logic
        }

        // === ACTION NODE: execute action ===
        if (nodeType === "action") {
          const actionType = data.actionType || "add_tag";
          const actionValue = (data.actionValue || "").trim();

          if (actionType === "add_tag" && actionValue) {
            await serviceClient
              .from("contact_tags")
              .upsert(
                { user_id: userId, remote_jid: jid, tag_name: actionValue.toLowerCase() },
                { onConflict: "user_id,remote_jid,tag_name" }
              );
            results.push(`action: add_tag "${actionValue}"`);
            console.log(`[execute-flow] Added tag "${actionValue}" to ${jid}`);
          } else if (actionType === "remove_tag" && actionValue) {
            await serviceClient
              .from("contact_tags")
              .delete()
              .eq("user_id", userId)
              .eq("remote_jid", jid)
              .ilike("tag_name", actionValue.toLowerCase());
            results.push(`action: remove_tag "${actionValue}"`);
            console.log(`[execute-flow] Removed tag "${actionValue}" from ${jid}`);
          } else {
            results.push(`action: ${actionType} "${actionValue}" (no-op)`);
          }

          // Continue to next nodes normally (don't skip)
        } else if (nodeType === "aiAgent") {
          // AI Agent: call OpenAI with conversation history
          if (!profile.openai_api_key) {
            results.push("aiAgent: error - OpenAI API Key não configurada");
          } else {
            const historyCount = data.aiHistoryCount || 10;
            const { data: historyMsgs } = await serviceClient
              .from("messages")
              .select("content, direction, message_type, media_url")
              .eq("remote_jid", jid)
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(historyCount);

            const openaiMessages: any[] = [];
            if (data.aiSystemPrompt) {
              openaiMessages.push({ role: "system", content: data.aiSystemPrompt });
            }

            const acceptedMedia = data.aiAcceptedMedia || ["text"];
            for (const msg of (historyMsgs || []).reverse()) {
              const role = msg.direction === "inbound" ? "user" : "assistant";
              if (msg.message_type === "text" && msg.content) {
                openaiMessages.push({ role, content: msg.content });
              } else if (msg.message_type === "image" && msg.media_url && acceptedMedia.includes("image")) {
                openaiMessages.push({
                  role,
                  content: [
                    { type: "text", text: msg.content || "Imagem enviada" },
                    { type: "image_url", image_url: { url: msg.media_url } },
                  ],
                });
              } else if (msg.message_type === "audio" && msg.media_url && acceptedMedia.includes("audio")) {
                openaiMessages.push({
                  role,
                  content: [
                    { type: "text", text: msg.content || "[Áudio]" },
                    { type: "input_audio", input_audio: { data: msg.media_url, format: "mp3" } },
                  ],
                });
              } else if (msg.message_type === "document" && msg.media_url && acceptedMedia.includes("pdf")) {
                openaiMessages.push({
                  role,
                  content: [
                    { type: "text", text: msg.content || "[PDF]" },
                    { type: "text", text: `[Documento: ${msg.media_url}]` },
                  ],
                });
              } else if (msg.content) {
                openaiMessages.push({ role, content: msg.content });
              }
            }

            const aiModel = data.aiModel || "gpt-4o";
            const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${profile.openai_api_key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: aiModel,
                messages: openaiMessages,
                temperature: data.aiTemperature ?? 0.7,
                max_tokens: data.aiMaxTokens || 500,
              }),
            });

            const aiData = await aiResp.json();
            const aiResponse = aiData?.choices?.[0]?.message?.content || "";
            console.log(`[execute-flow] AI response (${aiModel}):`, aiResponse.substring(0, 100));

            if (data.aiAutoSend !== false && aiResponse) {
              const sendResp = await fetch(`${baseUrl}/message/sendText/${evolution_instance_name}`, {
                method: "POST",
                headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                body: JSON.stringify({ number: jid, text: aiResponse }),
              });
              const sendResult = await sendResp.json();

              const { data: conv } = await serviceClient
                .from("conversations")
                .upsert(
                  { user_id: userId, remote_jid: jid, last_message: aiResponse.substring(0, 50), last_message_at: new Date().toISOString(), instance_name: evolution_instance_name },
                  { onConflict: "user_id,remote_jid,instance_name" }
                )
                .select("id")
                .single();
              if (conv) {
                await serviceClient.from("messages").insert({
                  conversation_id: conv.id,
                  user_id: userId,
                  remote_jid: jid,
                  content: aiResponse,
                  message_type: "text",
                  direction: "outbound",
                  status: "sent",
                  external_id: sendResult?.key?.id || null,
                });
              }
            }
            results.push(`aiAgent: ok (${aiModel})`);
          }
        } else if (nodeType === "waitForClick") {
          // Generate tracked link and pause execution
          const clickUrl = data.clickUrl;
          if (!clickUrl) {
            results.push("waitForClick: error - URL não configurada");
          } else {
            const shortCode = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            const nextIds = outgoingMap.get(node.id) || [];
            const nextNodeId = nextIds.length > 0 ? nextIds[0] : null;

            await serviceClient.from("tracked_links").insert({
              user_id: userId,
              flow_id: flowId,
              execution_id: executionId,
              remote_jid: jid,
              original_url: clickUrl,
              short_code: shortCode,
              next_node_id: nextNodeId,
              conversation_id: conversationId || null,
              preview_title: data.clickPreviewTitle || null,
              preview_description: data.clickPreviewDescription || null,
              preview_image: data.clickPreviewImage || null,
              instance_name: evolution_instance_name,
            });

            const trackingUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/link-redirect?code=${shortCode}`;

            const messageTemplate = data.clickMessage || "Acesse: {{link}}";
            const messageText = resolveVariables(messageTemplate.replace(/\{\{link\}\}/gi, trackingUrl));

            const sendResp = await fetch(`${baseUrl}/message/sendText/${evolution_instance_name}`, {
              method: "POST",
              headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
              body: JSON.stringify({ number: jid, text: messageText }),
            });
            const sendResult = await sendResp.json();

            // Save outbound message
            const { data: conv } = await serviceClient
              .from("conversations")
              .upsert(
                { user_id: userId, remote_jid: jid, last_message: messageText.substring(0, 50), last_message_at: new Date().toISOString(), instance_name: evolution_instance_name },
                { onConflict: "user_id,remote_jid,instance_name" }
              )
              .select("id")
              .single();
            if (conv) {
              await serviceClient.from("messages").insert({
                conversation_id: conv.id,
                user_id: userId,
                remote_jid: jid,
                content: messageText,
                message_type: "text",
                direction: "outbound",
                status: "sent",
                external_id: sendResult?.key?.id || null,
              });
            }

            // Pause execution - waiting for click
            await serviceClient
              .from("flow_executions")
              .update({ status: "waiting_click", current_node_index: nodeIndex, waiting_node_id: node.id })
              .eq("id", executionId);

            // Insert timeout if configured
            const clickTimeout = data.clickTimeout || 0;
            if (clickTimeout > 0) {
              const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
              const unit = data.clickTimeoutUnit || "minutes";
              const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
              const timeoutAt = new Date(Date.now() + clickTimeout * multiplier).toISOString();
              await serviceClient.from("flow_timeouts").insert({
                execution_id: executionId,
                flow_id: flowId,
                user_id: userId,
                remote_jid: jid,
                conversation_id: conversationId || null,
                timeout_node_id: timeoutNodeId,
                timeout_at: timeoutAt,
              });
              console.log(`[execute-flow] Timeout set for waitForClick: ${timeoutAt} -> node ${timeoutNodeId || '(end flow)'}`);
            }

            results.push(`waitForClick: paused (code=${shortCode})`);
            // Stop processing further nodes
            break;
          }
        } else if (nodeType === "waitForReply") {
          // Pause execution - waiting for reply
          await serviceClient
            .from("flow_executions")
            .update({ status: "waiting_reply", current_node_index: nodeIndex, waiting_node_id: node.id })
            .eq("id", executionId);

          // Insert timeout if configured
          const replyTimeout = data.replyTimeout || 0;
          if (replyTimeout > 0) {
            const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
            const unit = data.replyTimeoutUnit || "minutes";
            const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
            const timeoutAt = new Date(Date.now() + replyTimeout * multiplier).toISOString();
            await serviceClient.from("flow_timeouts").insert({
              execution_id: executionId,
              flow_id: flowId,
              user_id: userId,
              remote_jid: jid,
              conversation_id: conversationId || null,
              timeout_node_id: timeoutNodeId,
              timeout_at: timeoutAt,
            });
            console.log(`[execute-flow] Timeout set for waitForReply: ${timeoutAt} -> node ${timeoutNodeId || '(end flow)'}`);
          }

          results.push(`waitForReply: paused (var=${data.replyVariable || "resposta"})`);
          break;
        } else if ((nodeType === "group" || nodeType === "groupBlock") && data.steps) {
          // Execute all steps in group sequentially - handle waitForClick inside groups
          let groupPaused = false;
          for (let si = 0; si < data.steps.length; si++) {
            const step = data.steps[si];
            if (step.data.type === "waitForClick") {
              const clickUrl = step.data.clickUrl;
              if (!clickUrl) {
                results.push(`group.${step.id}: waitForClick: error - URL não configurada`);
                continue;
              }
              const shortCode = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
              // Next node is the next step in group, or if last step, the next connected node
              let nextNodeId: string | null = null;
              if (si < data.steps.length - 1) {
                // There are more steps in the group - we need to resume from this group node
                // but we can't resume mid-group easily, so we use the next connected node
                nextNodeId = (outgoingMap.get(node.id) || [])[0] || null;
              } else {
                nextNodeId = (outgoingMap.get(node.id) || [])[0] || null;
              }

              // Always use edge function URL — SPA can't serve OG tags for crawlers

              await serviceClient.from("tracked_links").insert({
                user_id: userId,
                flow_id: flowId,
                execution_id: executionId,
                remote_jid: jid,
                original_url: clickUrl,
                short_code: shortCode,
                next_node_id: nextNodeId,
                conversation_id: conversationId || null,
                preview_title: step.data.clickPreviewTitle || null,
                preview_description: step.data.clickPreviewDescription || null,
                preview_image: step.data.clickPreviewImage || null,
                instance_name: evolution_instance_name,
              });

              const trackingUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/link-redirect?code=${shortCode}`;
              const messageTemplate = step.data.clickMessage || "Acesse: {{link}}";
              const messageText = resolveVariables(messageTemplate.replace(/\{\{link\}\}/gi, trackingUrl));

              const sendResp = await fetch(`${baseUrl}/message/sendText/${evolution_instance_name}`, {
                method: "POST",
                headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                body: JSON.stringify({ number: jid, text: messageText }),
              });
              const sendResult = await sendResp.json();

              // Save outbound message for group waitForClick
              const { data: conv } = await serviceClient
                .from("conversations")
                .upsert(
                  { user_id: userId, remote_jid: jid, last_message: messageText.substring(0, 50), last_message_at: new Date().toISOString(), instance_name: evolution_instance_name },
                  { onConflict: "user_id,remote_jid,instance_name" }
                )
                .select("id")
                .single();
              if (conv) {
                await serviceClient.from("messages").insert({
                  conversation_id: conv.id,
                  user_id: userId,
                  remote_jid: jid,
                  content: messageText,
                  message_type: "text",
                  direction: "outbound",
                  status: "sent",
                  external_id: sendResult?.key?.id || null,
                });
              }

              await serviceClient
                .from("flow_executions")
                .update({ status: "waiting_click", current_node_index: nodeIndex, waiting_node_id: node.id })
                .eq("id", executionId);

              // Insert timeout if configured (inside group)
              const clickTimeout = step.data.clickTimeout || 0;
              if (clickTimeout > 0) {
                const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
                const unit = step.data.clickTimeoutUnit || "minutes";
                const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
                const timeoutAt = new Date(Date.now() + clickTimeout * multiplier).toISOString();
                await serviceClient.from("flow_timeouts").insert({
                  execution_id: executionId,
                  flow_id: flowId,
                  user_id: userId,
                  remote_jid: jid,
                  conversation_id: conversationId || null,
                  timeout_node_id: timeoutNodeId,
                  timeout_at: timeoutAt,
                });
                console.log(`[execute-flow] Timeout set for group waitForClick: ${timeoutAt} -> node ${timeoutNodeId || '(end flow)'}`);
              }

              results.push(`group.${step.id}: waitForClick: paused (code=${shortCode})`);
              groupPaused = true;
              break;
            } else if (step.data.type === "waitForReply") {
              // Pause flow waiting for contact reply (inside group)
              console.log(`[execute-flow] Group waitForReply: pausing execution ${executionId}`);
              await serviceClient
                .from("flow_executions")
                .update({ status: "waiting_reply", current_node_index: nodeIndex, waiting_node_id: node.id })
                .eq("id", executionId);

              // Insert timeout if configured (inside group)
              const replyTimeout = step.data.replyTimeout || 0;
              if (replyTimeout > 0) {
                const timeoutNodeId = timeoutEdgeMap.get(node.id) || null;
                const unit = step.data.replyTimeoutUnit || "minutes";
                const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
                const timeoutAt = new Date(Date.now() + replyTimeout * multiplier).toISOString();
                await serviceClient.from("flow_timeouts").insert({
                  execution_id: executionId,
                  flow_id: flowId,
                  user_id: userId,
                  remote_jid: jid,
                  conversation_id: conversationId || null,
                  timeout_node_id: timeoutNodeId,
                  timeout_at: timeoutAt,
                });
                console.log(`[execute-flow] Timeout set for group waitForReply: ${timeoutAt} -> node ${timeoutNodeId || '(end flow)'}`);
              }

              results.push(`group.${step.id}: waitForReply: paused`);
              groupPaused = true;
              break;
            } else if (step.data.type === "action") {
              // Handle action steps inside groups
              const actionType = step.data.actionType || "add_tag";
              const actionValue = (step.data.actionValue || "").trim();
              if (actionType === "add_tag" && actionValue) {
                await serviceClient
                  .from("contact_tags")
                  .upsert(
                    { user_id: userId, remote_jid: jid, tag_name: actionValue.toLowerCase() },
                    { onConflict: "user_id,remote_jid,tag_name" }
                  );
                results.push(`group.${step.id}: action: add_tag "${actionValue}"`);
              } else if (actionType === "remove_tag" && actionValue) {
                await serviceClient
                  .from("contact_tags")
                  .delete()
                  .eq("user_id", userId)
                  .eq("remote_jid", jid)
                  .ilike("tag_name", actionValue.toLowerCase());
                results.push(`group.${step.id}: action: remove_tag "${actionValue}"`);
              } else {
                results.push(`group.${step.id}: action: ${actionType} (no-op)`);
              }
            } else {
              const stepResult = await executeStep(step.data, baseUrl, evolution_api_key, evolution_instance_name, jid, serviceClient, userId);
              results.push(`group.${step.id}: ${stepResult}`);
            }
          }
          if (groupPaused) break;
        } else {
          const result = await executeStep(data, baseUrl, evolution_api_key, evolution_instance_name, jid, serviceClient, userId);
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
    await serviceClient
      .from("flow_executions")
      .update({ status: "completed" })
      .eq("id", executionId)
      .eq("status", "running");

    return new Response(JSON.stringify({ ok: true, executed: results, executionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("execute-flow error:", err);
    if (executionId) {
      await serviceClient
        .from("flow_executions")
        .update({ status: "completed" })
        .eq("id", executionId);
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
