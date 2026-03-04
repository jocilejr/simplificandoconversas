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

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: link, error } = await serviceClient
    .from("tracked_links")
    .select("*")
    .eq("short_code", code)
    .single();

  if (error || !link) {
    return new Response("Link not found", { status: 404 });
  }

  // If not yet clicked, mark as clicked and resume flow
  if (!link.clicked) {
    await serviceClient
      .from("tracked_links")
      .update({ clicked: true, clicked_at: new Date().toISOString() })
      .eq("id", link.id);

    // Resume the flow from the next node
    if (link.next_node_id && link.flow_id && link.execution_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        await fetch(`${supabaseUrl}/functions/v1/execute-flow`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            flowId: link.flow_id,
            remoteJid: link.remote_jid,
            conversationId: link.conversation_id,
            userId: link.user_id,
            resumeFromNodeId: link.next_node_id,
          }),
        });
        console.log(`[link-redirect] Resumed flow ${link.flow_id} from node ${link.next_node_id}`);
      } catch (err) {
        console.error("[link-redirect] Failed to resume flow:", err);
      }
    }
  }

  // Always redirect to original URL
  return new Response(null, {
    status: 302,
    headers: {
      Location: link.original_url,
      ...corsHeaders,
    },
  });
});
