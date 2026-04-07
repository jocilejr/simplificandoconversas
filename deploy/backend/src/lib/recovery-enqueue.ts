import { getServiceClient } from "./supabase";

/**
 * Enqueue a transaction for automatic recovery.
 * Called by webhook handlers after saving a pending/abandoned/rejected transaction.
 */
export async function enqueueRecovery(opts: {
  workspaceId: string;
  userId: string;
  transactionId: string;
  customerPhone: string | null;
  customerName: string | null;
  amount: number;
  transactionType: string;
}) {
  if (!opts.customerPhone) return;

  const sb = getServiceClient();

  // Fetch recovery settings for this workspace (no filter on deprecated 'enabled' column)
  const { data: settings } = await sb
    .from("recovery_settings")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();

  if (!settings) return;

  // Check per-type enablement
  const txType = opts.transactionType;
  if (txType === "boleto" && !settings.enabled_boleto) return;
  else if ((txType === "yampi_cart" || txType === "yampi") && !settings.enabled_yampi) return;
  else if (txType !== "boleto" && txType !== "yampi_cart" && txType !== "yampi" && !settings.enabled_pix) return;

  // Check if already queued for this transaction
  const { data: existing } = await sb
    .from("recovery_queue")
    .select("id")
    .eq("transaction_id", opts.transactionId)
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();

  if (existing) return;

  // No initial delay — the global message queue already controls spacing between sends
  const scheduledAt = new Date().toISOString();

  await sb.from("recovery_queue").insert({
    workspace_id: opts.workspaceId,
    user_id: opts.userId,
    transaction_id: opts.transactionId,
    customer_phone: opts.customerPhone.replace(/\D/g, ""),
    customer_name: opts.customerName || null,
    amount: opts.amount,
    transaction_type: opts.transactionType,
    status: "pending",
    scheduled_at: scheduledAt,
  });

  console.log(`[auto-recovery] Enqueued tx ${opts.transactionId} (${opts.transactionType}), scheduled at ${scheduledAt}`);
}
