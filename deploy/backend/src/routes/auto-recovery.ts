import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { dispatchRecovery } from "../lib/recovery-dispatch";

const router = Router();

/**
 * Manual-only processor — retries stuck "pending" items in recovery_queue.
 * The cron has been REMOVED to prevent infinite re-dispatch loops.
 * Use POST /process to manually retry stuck items if needed.
 */
export async function processRecoveryQueue() {
  const sb = getServiceClient();

  const cutoff = new Date(Date.now() - 120_000).toISOString();

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
      // Mark as processing first (not delete!) to prevent re-pickup
      await sb.from("recovery_queue").update({ status: "processing" }).eq("id", item.id);

      await dispatchRecovery({
        workspaceId: item.workspace_id,
        userId: item.user_id,
        transactionId: item.transaction_id,
        customerPhone: item.customer_phone,
        customerName: item.customer_name,
        amount: Number(item.amount),
        transactionType: item.transaction_type,
        skipDuplicateCheck: true,
      });

      console.log(`[auto-recovery] Retried stuck item ${item.id} for tx ${item.transaction_id}`);
    } catch (err: any) {
      // Mark as failed so it won't be retried again
      await sb.from("recovery_queue").update({
        status: "failed",
        error_message: err.message,
      }).eq("id", item.id);
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
