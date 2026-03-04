import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      // Server-to-server call (e.g. from webhook): trust the userId in the body
      userId = bodyUserId;
    } else {
      // Normal user call: validate JWT
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

    // Load flow (use serviceClient to bypass RLS for server-to-server calls)
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

    // Get Evolution API credentials
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

    // Auto-cleanup: cancel stuck "running" executions older than 5 minutes
    await serviceClient
      .from("flow_executions")
      .update({ status: "completed" })
      .eq("user_id", userId)
      .eq("flow_id", flowId)
      .eq("remote_jid", jid)
      .eq("status", "running")
      .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    console.log(`[execute-flow] Starting flow ${flowId} for ${jid}`);

    // Create flow execution record
    const { data: execution, error: execErr } = await serviceClient
      .from("flow_executions")
      .insert({
        user_id: userId,
        conversation_id: conversationId || null,
        flow_id: flowId,
        remote_jid: jid,
        status: "running",
      })
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

    // Parse flow nodes/edges
    const nodes = (flow.nodes || []) as any[];
    const edges = (flow.edges || []) as any[];

    const incomingMap = new Map<string, string[]>();
    const outgoingMap = new Map<string, string[]>();
    for (const edge of edges) {
      if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
      outgoingMap.get(edge.source)!.push(edge.target);
      if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
      incomingMap.get(edge.target)!.push(edge.source);
    }

    const startNodes = nodes.filter((n: any) => !incomingMap.has(n.id) || incomingMap.get(n.id)!.length === 0);
    if (startNodes.length === 0 && nodes.length > 0) {
      startNodes.push(nodes[0]);
    }

    // BFS execution with cancellation checks
    const visited = new Set<string>();
    const queue = [...startNodes];
    const results: string[] = [];
    let nodeIndex = 0;

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      // Check if execution was cancelled
      const { data: statusCheck } = await serviceClient
        .from("flow_executions")
        .select("status")
        .eq("id", executionId)
        .single();

      if (statusCheck?.status === "cancelled" || statusCheck?.status === "paused") {
        results.push(`execution ${statusCheck.status} at node ${nodeIndex}`);
        break;
      }

      // Update current node index
      await serviceClient
        .from("flow_executions")
        .update({ current_node_index: nodeIndex })
        .eq("id", executionId);

      const data = node.data || {};
      const children = data.children || [data];

      for (const child of children) {
        const childType = child.type;
        console.log(`[execute-flow] Processing child type: ${childType}, node: ${node.id}`);
        try {
          if (childType === "trigger") {
            results.push("trigger: skipped");
            continue;
          }

          if (childType === "sendText" && child.textContent) {
            const resp = await fetch(
              `${baseUrl}/message/sendText/${evolution_instance_name}`,
              {
                method: "POST",
                headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                body: JSON.stringify({ number: jid, text: child.textContent }),
              }
            );
            const r = await resp.json();
            console.log(`[execute-flow] sendText response:`, JSON.stringify(r));
            const { data: conv } = await serviceClient
              .from("conversations")
              .upsert(
                { user_id: userId, remote_jid: jid, last_message: child.textContent.substring(0, 50), last_message_at: new Date().toISOString() },
                { onConflict: "user_id,remote_jid" }
              )
              .select("id")
              .single();

            if (conv) {
              await serviceClient.from("messages").insert({
                conversation_id: conv.id,
                user_id: userId,
                remote_jid: jid,
                content: child.textContent,
                message_type: "text",
                direction: "outbound",
                status: "sent",
                external_id: r?.key?.id || null,
              });
            }
            results.push("sendText: ok");
          }

          if (childType === "sendImage" && child.mediaUrl) {
            const imgResp = await fetch(`${baseUrl}/message/sendMedia/${evolution_instance_name}`, {
              method: "POST",
              headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
              body: JSON.stringify({ number: jid, mediatype: "image", media: child.mediaUrl, caption: child.caption || "" }),
            });
            const imgR = await imgResp.json();
            console.log(`[execute-flow] sendImage response:`, JSON.stringify(imgR));
            results.push("sendImage: ok");
          }

          if (childType === "sendAudio" && child.audioUrl) {
            const audResp = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${evolution_instance_name}`, {
              method: "POST",
              headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
              body: JSON.stringify({ number: jid, audio: child.audioUrl }),
            });
            const audR = await audResp.json();
            console.log(`[execute-flow] sendAudio response:`, JSON.stringify(audR));
            results.push("sendAudio: ok");
          }

          if (childType === "sendVideo" && child.mediaUrl) {
            const vidResp = await fetch(`${baseUrl}/message/sendMedia/${evolution_instance_name}`, {
              method: "POST",
              headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
              body: JSON.stringify({ number: jid, mediatype: "video", media: child.mediaUrl, caption: child.caption || "" }),
            });
            const vidR = await vidResp.json();
            console.log(`[execute-flow] sendVideo response:`, JSON.stringify(vidR));
            results.push("sendVideo: ok");
          }

          if (childType === "waitDelay") {
            const delay = (child.delaySeconds || 3) * 1000;
            await sleep(Math.min(delay, 30000));
            results.push(`waitDelay: ${child.delaySeconds}s`);
          }
        } catch (err: any) {
          results.push(`${childType}: error - ${err.message}`);
        }
      }

      nodeIndex++;

      const nextIds = outgoingMap.get(node.id) || [];
      for (const nextId of nextIds) {
        const nextNode = nodes.find((n: any) => n.id === nextId);
        if (nextNode) queue.push(nextNode);
      }
    }

    console.log(`[execute-flow] Flow ${flowId} completed. Results:`, results);
    // Mark completed
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
