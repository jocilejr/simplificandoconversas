import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { dispatchRecovery } from "../lib/recovery-dispatch";

const router = Router();

/**
 * Fallback processor — retries stuck "pending" items in recovery_queue
 * that were not sent by the event-driven dispatch (e.g. server restart).
 * Called by cron every 10 seconds.
 */
export async function processRecoveryQueue() {
  const sb = getServiceClient();

  // Find pending items older than 60 seconds (should have been sent by dispatch)
  const cutoff = new Date(Date.now() - 60_000).toISOString();

  const { data: stuckItems } = await sb
    .from("recovery_queue")
    .select("id, workspace_id, user_id, transaction_id, customer_phone, customer_name, amount, transaction_type")
    .eq("status", "pending")
    .lte("scheduled_at", cutoff)
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (!stuckItems || stuckItems.length === 0) return;

  for (const item of stuckItems) {
    try {
      // Delete the stuck record so dispatchRecovery can re-create it
      await sb.from("recovery_queue").delete().eq("id", item.id);

      // Re-dispatch through the event-driven path
      await dispatchRecovery({
        workspaceId: item.workspace_id,
        userId: item.user_id,
        transactionId: item.transaction_id,
        customerPhone: item.customer_phone,
        customerName: item.customer_name,
        amount: Number(item.amount),
        transactionType: item.transaction_type,
      });

      console.log(`[auto-recovery] Retried stuck item ${item.id} for tx ${item.transaction_id}`);
    } catch (err: any) {
      console.error(`[auto-recovery] Retry failed for ${item.id}:`, err.message);
    }
  }
}

// Manual trigger endpoint (for testing)
router.post("/process", async (_req, res) => {
  try {
    await processRecoveryQueue();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
