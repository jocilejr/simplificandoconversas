import { restGet, restUpdate } from "../lib/supabase";

export async function processTimeouts() {
  let pendingTimeouts: any[] = [];
  try {
    const nowIso = new Date().toISOString();
    pendingTimeouts = await restGet<any>(
      "flow_timeouts",
      `processed=eq.false&timeout_at=lte.${encodeURIComponent(nowIso)}&select=*&limit=50`
    );
  } catch (err: any) {
    console.error("[check-timeouts] Fetch error:", err?.message, err?.cause?.message);
    return;
  }

  if (!pendingTimeouts || pendingTimeouts.length === 0) return;

  console.log(`[check-timeouts] Found ${pendingTimeouts.length} expired timeouts`);

  for (const timeout of pendingTimeouts) {
    try {
if (timeout.remote_jid?.includes("@g.us")) { console.log("[check-timeouts] Skipping group JID: " + timeout.id); await restUpdate("flow_timeouts", "id=eq." + encodeURIComponent(timeout.id), { processed: true }); continue; }
      const execRows = await restGet<{ status: string; instance_name: string | null }>(
        "flow_executions",
        `id=eq.${encodeURIComponent(timeout.execution_id)}&select=status,instance_name&limit=1`
      );
      const execution = execRows[0];

      if (!execution || !["waiting_click", "waiting_reply"].includes(execution.status)) {
        console.log(`[check-timeouts] Skipping timeout ${timeout.id} — execution status is '${execution?.status ?? "not found"}'`);
        await restUpdate("flow_timeouts", `id=eq.${encodeURIComponent(timeout.id)}`, { processed: true });
        continue;
      }

      await restUpdate("flow_executions", `id=eq.${encodeURIComponent(timeout.execution_id)}`, { status: "completed" });
      await restUpdate("flow_timeouts", `id=eq.${encodeURIComponent(timeout.id)}`, { processed: true });

      if (timeout.timeout_node_id) {
        let resolvedConvId = timeout.conversation_id;
        if (!resolvedConvId && timeout.remote_jid && timeout.user_id) {
          try {
            const convs = await restGet<{ id: string }>(
              "conversations",
              `user_id=eq.${encodeURIComponent(timeout.user_id)}&remote_jid=eq.${encodeURIComponent(timeout.remote_jid)}&select=id&limit=1`
            );
            if (convs[0]) resolvedConvId = convs[0].id;
          } catch (e: any) {
            console.warn(`[check-timeouts] conv lookup failed: ${e.message}`);
          }
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
