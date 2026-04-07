import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

/**
 * Enqueue a transaction for automatic recovery.
 * Called internally by webhook handlers after saving a pending/abandoned transaction.
 */
export async function enqueueRecovery(opts: {
  workspaceId: string;
  userId: string;
  transactionId: string;
  customerPhone: string;
  customerName: string | null;
  amount: number;
  transactionType: string;
}) {
  const sb = getServiceClient();

  // Check if recovery is enabled for this workspace
  const { data: settings } = await sb
    .from("recovery_settings")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .eq("enabled", true)
    .maybeSingle();

  if (!settings) return;
  if (!opts.customerPhone) return;

  // Check if already queued for this transaction
  const { data: existing } = await sb
    .from("recovery_queue")
    .select("id")
    .eq("transaction_id", opts.transactionId)
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();

  if (existing) return;

  const sendAfterMinutes = settings.send_after_minutes || 5;
  const scheduledAt = new Date(Date.now() + sendAfterMinutes * 60 * 1000).toISOString();

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

  console.log(`[auto-recovery] Enqueued tx ${opts.transactionId} for workspace ${opts.workspaceId}, scheduled at ${scheduledAt}`);
}

/**
 * Get greeting based on Brasília time (UTC-3)
 */
function getGreeting(): string {
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brasiliaHour >= 5 && brasiliaHour < 12) return "Bom dia";
  if (brasiliaHour >= 12 && brasiliaHour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Replace message variables
 */
function replaceVariables(template: string, vars: { name: string | null; amount: number }): string {
  const firstName = vars.name ? vars.name.split(" ")[0] : "cliente";
  const fullName = vars.name || "cliente";
  const formattedAmount = `R$ ${vars.amount.toFixed(2).replace(".", ",")}`;

  return template
    .replace(/\{saudação\}/gi, getGreeting())
    .replace(/\{saudacao\}/gi, getGreeting())
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{nome\}/gi, fullName)
    .replace(/\{valor\}/gi, formattedAmount);
}

/**
 * Process the recovery queue — called by cron every 10 seconds.
 * For each workspace with enabled auto-recovery, sends at most 1 message per cycle,
 * respecting the configured delay_seconds since the last sent message.
 */
export async function processRecoveryQueue() {
  const sb = getServiceClient();

  // Get all enabled recovery settings
  const { data: allSettings } = await sb
    .from("recovery_settings")
    .select("*")
    .eq("enabled", true);

  if (!allSettings || allSettings.length === 0) return;

  for (const settings of allSettings) {
    try {
      const workspaceId = settings.workspace_id;

      // Determine instance based on transaction type (will be checked per item)
      const defaultInstance = settings.instance_name;

      // Get first pending item that is ready to send
      const { data: item } = await sb
        .from("recovery_queue")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!item) continue;

      // Determine the instance for this transaction type
      const txType = item.transaction_type;
      let instanceName: string | null = null;
      if (txType === "boleto") instanceName = settings.instance_boleto || defaultInstance;
      else if (txType === "yampi_cart" || txType === "yampi") instanceName = settings.instance_yampi || defaultInstance;
      else instanceName = settings.instance_pix || defaultInstance;

      if (!instanceName) {
        console.log(`[auto-recovery] No instance configured for type ${txType} in workspace ${workspaceId}`);
        continue;
      }

      // Get delay and pause config from message_queue_config for this instance
      const { data: queueConfig } = await sb
        .from("message_queue_config")
        .select("delay_seconds, pause_after_sends, pause_minutes")
        .eq("workspace_id", workspaceId)
        .eq("instance_name", instanceName)
        .maybeSingle();

      const delaySeconds = Math.max(queueConfig?.delay_seconds || 30, 5);
      const pauseAfterSends = queueConfig?.pause_after_sends || null;
      const pauseMinutes = queueConfig?.pause_minutes || null;

      // Check pause: if pause is configured, count recent sends and check if we need to pause
      if (pauseAfterSends && pauseMinutes) {
        // Count how many messages were sent since last pause window
        const pauseWindowStart = new Date(Date.now() - pauseMinutes * 60 * 1000).toISOString();

        // Get the last pause_after_sends messages sent
        const { data: recentSends } = await sb
          .from("recovery_queue")
          .select("sent_at")
          .eq("workspace_id", workspaceId)
          .eq("status", "sent")
          .order("sent_at", { ascending: false })
          .limit(pauseAfterSends);

        if (recentSends && recentSends.length >= pauseAfterSends) {
          // Check if the oldest of the recent batch is within the pause window
          const oldestInBatch = recentSends[recentSends.length - 1]?.sent_at;
          if (oldestInBatch && new Date(oldestInBatch).getTime() > new Date(pauseWindowStart).getTime()) {
            // All N messages were sent within the pause window — we're in a pause period
            console.log(`[auto-recovery] Pause active for ${instanceName} in workspace ${workspaceId}: ${pauseAfterSends} msgs sent within ${pauseMinutes}min`);
            continue;
          }
        }
      }

      // Check if enough time passed since last send for this instance
      const { data: lastSent } = await sb
        .from("recovery_queue")
        .select("sent_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSent?.sent_at) {
        const elapsed = (Date.now() - new Date(lastSent.sent_at).getTime()) / 1000;
        if (elapsed < delaySeconds) {
          continue; // Not enough time passed
        }
      }

      // Check if transaction is still pending (may have been paid in the meantime)
      const { data: tx } = await sb
        .from("transactions")
        .select("status")
        .eq("id", item.transaction_id)
        .maybeSingle();

      if (!tx || tx.status === "aprovado" || tx.status === "reembolsado") {
        // Transaction no longer needs recovery
        await sb.from("recovery_queue").update({ status: "cancelled" }).eq("id", item.id);
        console.log(`[auto-recovery] Cancelled queue item ${item.id} — tx already ${tx?.status || "deleted"}`);
        continue;
      }

      // Get workspace info for Evolution API URL
      const { data: workspace } = await sb
        .from("workspaces")
        .select("api_public_url, app_public_url")
        .eq("id", workspaceId)
        .maybeSingle();

      // Get the recovery message template from the workspace owner's profile
      const { data: profile } = await sb
        .from("profiles")
        .select("recovery_message_boleto, recovery_message_pix")
        .eq("user_id", settings.user_id)
        .maybeSingle();

      // Choose message template based on type
      const isBoleto = txType === "boleto";
      const defaultMsg = isBoleto
        ? `{saudação}, {primeiro_nome}! 😊\n\nVi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?\n\nCaso já tenha pago, pode desconsiderar essa mensagem! 🙏`
        : `{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏`;

      const template = isBoleto
        ? (profile?.recovery_message_boleto || defaultMsg)
        : (profile?.recovery_message_pix || defaultMsg);

      const message = replaceVariables(template, {
        name: item.customer_name,
        amount: Number(item.amount),
      });

      // Format phone as JID
      let phone = item.customer_phone.replace(/\D/g, "");
      if (!phone.includes("@")) {
        phone = phone + "@s.whatsapp.net";
      }

      // Send via Evolution API
      const evoBaseUrl = process.env.EVOLUTION_API_URL || "http://evolution:8080";
      const evoApiKey = process.env.EVOLUTION_API_KEY || "";

      try {
        const resp = await fetch(`${evoBaseUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evoApiKey,
          },
          body: JSON.stringify({
            number: phone,
            text: message,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Evolution API ${resp.status}: ${errText}`);
        }

        await sb.from("recovery_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", item.id);

        console.log(`[auto-recovery] Sent recovery to ${item.customer_phone} (ws: ${workspaceId})`);
      } catch (sendErr: any) {
        await sb.from("recovery_queue").update({
          status: "failed",
          error_message: sendErr.message?.substring(0, 500),
        }).eq("id", item.id);

        console.error(`[auto-recovery] Failed to send to ${item.customer_phone}:`, sendErr.message);
      }
    } catch (err: any) {
      console.error(`[auto-recovery] Error processing workspace ${settings.workspace_id}:`, err.message);
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
