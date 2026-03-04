import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  evolution_api_key: string,
  evolution_instance_name: string,
  jid: string,
  serviceClient: any,
  userId: string
): Promise<string> {
  const nodeType = stepData.type;

  if (nodeType === "trigger") {
    return "trigger: skipped";
  }

  if (nodeType === "sendText" && stepData.textContent) {
    const resp = await fetch(`${baseUrl}/message/sendText/${evolution_instance_name}`, {
      method: "POST",
      headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, text: stepData.textContent }),
    });
    const r = await resp.json();
    console.log(`[execute-flow] sendText response:`, JSON.stringify(r));
    const { data: conv } = await serviceClient
      .from("conversations")
      .upsert(
        { user_id: userId, remote_jid: jid, last_message: stepData.textContent.substring(0, 50), last_message_at: new Date().toISOString() },
        { onConflict: "user_id,remote_jid" }
      )
      .select("id")
      .single();
    if (conv) {
      await serviceClient.from("messages").insert({
        conversation_id: conv.id,
        user_id: userId,
        remote_jid: jid,
        content: stepData.textContent,
        message_type: "text",
        direction: "outbound",
        status: "sent",
        external_id: r?.key?.id || null,
      });
    }
    return "sendText: ok";
  }

  if (nodeType === "sendImage" && stepData.mediaUrl) {
    await fetch(`${baseUrl}/message/sendMedia/${evolution_instance_name}`, {
      method: "POST",
      headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, mediatype: "image", media: stepData.mediaUrl, caption: stepData.caption || "" }),
    });
    return "sendImage: ok";
  }

  if (nodeType === "sendAudio" && stepData.audioUrl) {
    await fetch(`${baseUrl}/message/sendWhatsAppAudio/${evolution_instance_name}`, {
      method: "POST",
      headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, audio: stepData.audioUrl }),
    });
    return "sendAudio: ok";
  }

  if (nodeType === "sendVideo" && stepData.mediaUrl) {
    await fetch(`${baseUrl}/message/sendMedia/${evolution_instance_name}`, {
      method: "POST",
      headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ number: jid, mediatype: "video", media: stepData.mediaUrl, caption: stepData.caption || "" }),
    });
    return "sendVideo: ok";
  }

  if (nodeType === "waitDelay") {
    const delay = (stepData.delaySeconds || 3) * 1000;
    await sleep(Math.min(delay, 30000));
    return `waitDelay: ${stepData.delaySeconds}s`;
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

    const { flowId, remoteJid, conversationId, userId: bodyUserId } = await req.json();

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

    const { data: flow, error: flowErr } = await serviceClient
      .from("chatbot_flows")
      .select("*")
      .eq("id", flowId)
      .eq("user_id", userId)
      .single();

    if (flowErr || !flow) {
      return new Response(JSON.stringify({ error: "Flow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("evolution_api_url, evolution_api_key, evolution_instance_name")
      .eq("user_id", userId)
      .single();

    if (!profile?.evolution_api_url || !profile?.evolution_api_key || !profile?.evolution_instance_name) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { evolution_api_url, evolution_api_key, evolution_instance_name } = profile;
    const baseUrl = evolution_api_url.replace(/\/$/, "");
    const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;

    // Auto-cleanup stuck executions older than 5 minutes
    await serviceClient
      .from("flow_executions")
      .update({ status: "completed" })
      .eq("user_id", userId)
      .eq("flow_id", flowId)
      .eq("remote_jid", jid)
      .eq("status", "running")
      .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    console.log(`[execute-flow] Starting flow ${flowId} for ${jid}`);

    const { data: execution, error: execErr } = await serviceClient
      .from("flow_executions")
      .insert({ user_id: userId, conversation_id: conversationId || null, flow_id: flowId, remote_jid: jid, status: "running" })
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

    const outgoingMap = new Map<string, string[]>();
    for (const edge of edges) {
      if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
      outgoingMap.get(edge.source)!.push(edge.target);
    }

    const targetsSet = new Set(edges.map((e: any) => e.target));
    const startNodes = nodes.filter((n: any) => !targetsSet.has(n.id));
    if (startNodes.length === 0 && nodes.length > 0) {
      startNodes.push(nodes[0]);
    }

    const visited = new Set<string>();
    const queue = [...startNodes];
    const results: string[] = [];
    let nodeIndex = 0;

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      const { data: statusCheck } = await serviceClient
        .from("flow_executions")
        .select("status")
        .eq("id", executionId)
        .single();

      if (statusCheck?.status === "cancelled" || statusCheck?.status === "paused") {
        results.push(`execution ${statusCheck.status} at node ${nodeIndex}`);
        break;
      }

      await serviceClient
        .from("flow_executions")
        .update({ current_node_index: nodeIndex })
        .eq("id", executionId);

      const data = node.data || {};
      const nodeType = data.type;
      console.log(`[execute-flow] Processing node ${node.id}, type: ${nodeType}`);

      try {
        if ((nodeType === "group" || nodeType === "groupBlock") && data.steps) {
          // Execute all steps in group sequentially
          for (const step of data.steps) {
            const stepResult = await executeStep(step.data, baseUrl, evolution_api_key, evolution_instance_name, jid, serviceClient, userId);
            results.push(`group.${step.id}: ${stepResult}`);
          }
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
