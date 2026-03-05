import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Find all pending timeouts that have expired
    const { data: pendingTimeouts, error: fetchErr } = await supabase
      .from("flow_timeouts")
      .select("*")
      .eq("processed", false)
      .lte("timeout_at", new Date().toISOString())
      .limit(50);

    if (fetchErr) {
      console.error("[check-timeouts] Fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingTimeouts || pendingTimeouts.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[check-timeouts] Found ${pendingTimeouts.length} expired timeouts`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let processedCount = 0;

    for (const timeout of pendingTimeouts) {
      try {
        // Mark the original execution as completed
        await supabase
          .from("flow_executions")
          .update({ status: "completed" })
          .eq("id", timeout.execution_id);

        // Mark this timeout as processed
        await supabase
          .from("flow_timeouts")
          .update({ processed: true })
          .eq("id", timeout.id);

        // Resume the flow from the timeout node (fire-and-forget)
        fetch(`${supabaseUrl}/functions/v1/execute-flow`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            flowId: timeout.flow_id,
            remoteJid: timeout.remote_jid,
            conversationId: timeout.conversation_id,
            userId: timeout.user_id,
            resumeFromNodeId: timeout.timeout_node_id,
          }),
        })
          .then((r) => r.json())
          .then((r) => console.log(`[check-timeouts] Resume result for ${timeout.id}:`, r))
          .catch((e) => console.error(`[check-timeouts] Resume error for ${timeout.id}:`, e));

        processedCount++;
      } catch (err: any) {
        console.error(`[check-timeouts] Error processing timeout ${timeout.id}:`, err.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: processedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[check-timeouts] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
