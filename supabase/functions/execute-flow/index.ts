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

    const { flowId, remoteJid } = await req.json();
    if (!flowId || !remoteJid) {
      return new Response(JSON.stringify({ error: "flowId and remoteJid required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load flow
    const { data: flow, error: flowErr } = await supabase
      .from("chatbot_flows")
      .select("*")
      .eq("id", flowId)
      .single();

    if (flowErr || !flow) {
      return new Response(JSON.stringify({ error: "Flow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Evolution API credentials
    const { data: profile } = await supabase
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

    // Parse flow: traverse nodes in order following edges
    const nodes = (flow.nodes || []) as any[];
    const edges = (flow.edges || []) as any[];

    // Build execution order: start from nodes with no incoming edges, follow edges
    const incomingMap = new Map<string, string[]>();
    const outgoingMap = new Map<string, string[]>();
    for (const edge of edges) {
      if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
      outgoingMap.get(edge.source)!.push(edge.target);
      if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
      incomingMap.get(edge.target)!.push(edge.source);
    }

    // Find start nodes (no incoming edges)
    const startNodes = nodes.filter((n: any) => !incomingMap.has(n.id) || incomingMap.get(n.id)!.length === 0);
    if (startNodes.length === 0 && nodes.length > 0) {
      startNodes.push(nodes[0]); // fallback
    }

    // BFS execution
    const visited = new Set<string>();
    const queue = [...startNodes];
    const results: string[] = [];
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const jid = remoteJid.includes("@") ? remoteJid : `${remoteJid}@s.whatsapp.net`;

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      const data = node.data || {};
      const children = data.children || [data]; // If no children, treat node data as single item

      for (const child of children) {
        const childType = child.type;

        try {
          if (childType === "trigger") {
            // Skip trigger nodes during execution
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

            // Save to DB
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
            results.push(`sendText: ok`);
          }

          if (childType === "sendImage" && child.mediaUrl) {
            await fetch(
              `${baseUrl}/message/sendMedia/${evolution_instance_name}`,
              {
                method: "POST",
                headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                body: JSON.stringify({ number: jid, mediatype: "image", media: child.mediaUrl, caption: child.caption || "" }),
              }
            );
            results.push("sendImage: ok");
          }

          if (childType === "sendAudio" && child.audioUrl) {
            await fetch(
              `${baseUrl}/message/sendWhatsAppAudio/${evolution_instance_name}`,
              {
                method: "POST",
                headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                body: JSON.stringify({ number: jid, audio: child.audioUrl }),
              }
            );
            results.push("sendAudio: ok");
          }

          if (childType === "sendVideo" && child.mediaUrl) {
            await fetch(
              `${baseUrl}/message/sendMedia/${evolution_instance_name}`,
              {
                method: "POST",
                headers: { apikey: evolution_api_key, "Content-Type": "application/json" },
                body: JSON.stringify({ number: jid, mediatype: "video", media: child.mediaUrl, caption: child.caption || "" }),
              }
            );
            results.push("sendVideo: ok");
          }

          if (childType === "waitDelay") {
            const delay = (child.delaySeconds || 3) * 1000;
            await sleep(Math.min(delay, 30000)); // max 30s per delay
            results.push(`waitDelay: ${child.delaySeconds}s`);
          }

        } catch (err: any) {
          results.push(`${childType}: error - ${err.message}`);
        }
      }

      // Follow edges to next nodes
      const nextIds = outgoingMap.get(node.id) || [];
      for (const nextId of nextIds) {
        const nextNode = nodes.find((n: any) => n.id === nextId);
        if (nextNode) queue.push(nextNode);
      }
    }

    return new Response(JSON.stringify({ ok: true, executed: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("execute-flow error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
