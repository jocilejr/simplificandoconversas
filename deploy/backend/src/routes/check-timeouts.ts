import { getServiceClient } from "../lib/supabase";

export async function processTimeouts() {
  const supabase = getServiceClient();

  const { data: pendingTimeouts, error: fetchErr } = await supabase
    .from("flow_timeouts")
    .select("*")
    .eq("processed", false)
    .lte("timeout_at", new Date().toISOString())
    .limit(50);

  if (fetchErr) {
    console.error("[check-timeouts] Fetch error:", fetchErr);
    return;
  }

  if (!pendingTimeouts || pendingTimeouts.length === 0) return;

  console.log(`[check-timeouts] Found ${pendingTimeouts.length} expired timeouts`);

  for (const timeout of pendingTimeouts) {
    try {
      const { data: execution } = await supabase
        .from("flow_executions")
        .select("status, instance_name")
        .eq("id", timeout.execution_id)
        .single();

      if (!execution || !["waiting_click", "waiting_reply"].includes(execution.status)) {
        console.log(`[check-timeouts] Skipping timeout ${timeout.id} — execution status is '${execution?.status ?? "not found"}'`);
        await supabase.from("flow_timeouts").update({ processed: true }).eq("id", timeout.id);
        continue;
      }

      await supabase.from("flow_executions").update({ status: "completed" }).eq("id", timeout.execution_id);
      await supabase.from("flow_timeouts").update({ processed: true }).eq("id", timeout.id);

      if (timeout.timeout_node_id) {
        let resolvedConvId = timeout.conversation_id;
        if (!resolvedConvId && timeout.remote_jid && timeout.user_id) {
          const { data: convLookup } = await supabase
            .from("conversations").select("id").eq("user_id", timeout.user_id).eq("remote_jid", timeout.remote_jid).limit(1).single();
          if (convLookup) resolvedConvId = convLookup.id;
        }

        const backendUrl = `http://localhost:${process.env.PORT || 3001}`;
        fetch(`${backendUrl}/api/execute-flow`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            flowId: timeout.flow_id, remoteJid: timeout.remote_jid, conversationId: resolvedConvId,
            userId: timeout.user_id, resumeFromNodeId: timeout.timeout_node_id,
            instanceName: execution.instance_name || undefined,
          }),
        })
          .then((r) => r.json())
          .then((r) => console.log(`[check-timeouts] Resume result for ${timeout.id}:`, r))
          .catch((e) => console.error(`[check-timeouts] Resume error for ${timeout.id}:`, e));
      } else {
        console.log(`[check-timeouts] Timeout ${timeout.id} has no target node - flow ended`);
      }
    } catch (err: any) {
      console.error(`[check-timeouts] Error processing timeout ${timeout.id}:`, err.message);
    }
  }
}
