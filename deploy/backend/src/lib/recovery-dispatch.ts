/**
 * Recovery Dispatch — Event-driven recovery sender.
 *
 * Called immediately after a transaction is saved/updated to pending.
 * Uses the global MessageQueue for anti-ban serialization.
 * Writes audit trail to recovery_queue.
 */

import { getServiceClient } from "./supabase";
import { getMessageQueue } from "./message-queue";

function getGreeting(): string {
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brasiliaHour >= 5 && brasiliaHour < 12) return "Bom dia";
  if (brasiliaHour >= 12 && brasiliaHour < 18) return "Boa tarde";
  return "Boa noite";
}

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
 * Dispatch recovery for a single transaction immediately.
 * This is the main entry point — call after saving a pending transaction.
 */
export async function dispatchRecovery(opts: {
  workspaceId: string;
  userId: string;
  transactionId: string;
  customerPhone: string | null;
  customerName: string | null;
  amount: number;
  transactionType: string; // "boleto" | "pix" | "yampi" | "yampi_cart"
}) {
  if (!opts.customerPhone) return;

  const sb = getServiceClient();
  const txType = opts.transactionType;

  // 1. Load recovery_settings for this workspace
  const { data: settings } = await sb
    .from("recovery_settings")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();

  if (!settings) {
    console.log(`[recovery-dispatch] No recovery_settings for workspace ${opts.workspaceId}`);
    return;
  }

  // 2. Check per-type enablement
  if (txType === "boleto" && !settings.enabled_boleto) return;
  else if ((txType === "yampi_cart" || txType === "yampi") && !settings.enabled_yampi) return;
  else if (txType !== "boleto" && txType !== "yampi_cart" && txType !== "yampi" && !settings.enabled_pix) return;

  // 3. Check duplicate
  const { data: existing } = await sb
    .from("recovery_queue")
    .select("id")
    .eq("transaction_id", opts.transactionId)
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();

  if (existing) {
    console.log(`[recovery-dispatch] Already queued for tx ${opts.transactionId}`);
    return;
  }

  // 4. Resolve instance
  const defaultInstance = settings.instance_name;
  let instanceName: string | null = null;
  if (txType === "boleto") instanceName = settings.instance_boleto || defaultInstance;
  else if (txType === "yampi_cart" || txType === "yampi") instanceName = settings.instance_yampi || defaultInstance;
  else instanceName = settings.instance_pix || defaultInstance;

  if (!instanceName) {
    console.log(`[recovery-dispatch] No instance configured for type ${txType}`);
    return;
  }

  // 5. Get message template
  const { data: profile } = await sb
    .from("profiles")
    .select("recovery_message_boleto, recovery_message_pix")
    .eq("user_id", settings.user_id)
    .maybeSingle();

  const isBoleto = txType === "boleto";
  const defaultMsg = isBoleto
    ? `{saudação}, {primeiro_nome}! 😊\n\nVi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?\n\nCaso já tenha pago, pode desconsiderar essa mensagem! 🙏`
    : `{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏`;

  const template = isBoleto
    ? (profile?.recovery_message_boleto || defaultMsg)
    : (profile?.recovery_message_pix || defaultMsg);

  const message = replaceVariables(template, {
    name: opts.customerName,
    amount: opts.amount,
  });

  // 6. Format phone
  let phone = opts.customerPhone.replace(/\D/g, "");
  if (!phone.includes("@")) {
    phone = phone + "@s.whatsapp.net";
  }

  // 7. Insert audit record as pending
  const { data: queueItem } = await sb
    .from("recovery_queue")
    .insert({
      workspace_id: opts.workspaceId,
      user_id: opts.userId,
      transaction_id: opts.transactionId,
      customer_phone: opts.customerPhone.replace(/\D/g, ""),
      customer_name: opts.customerName || null,
      amount: opts.amount,
      transaction_type: txType,
      status: "pending",
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const queueId = queueItem?.id;
  console.log(`[recovery-dispatch] Queued tx ${opts.transactionId} (${txType}), queue id: ${queueId}`);

  // 8. Load message_queue_config for delay
  const { data: queueConfig } = await sb
    .from("message_queue_config")
    .select("delay_seconds")
    .eq("workspace_id", opts.workspaceId)
    .eq("instance_name", instanceName)
    .maybeSingle();

  const delayMs = (Math.max(queueConfig?.delay_seconds || 30, 5)) * 1000;

  // 9. Enqueue into the global message queue for this instance
  const queue = getMessageQueue(instanceName, delayMs);

  const evoBaseUrl = process.env.EVOLUTION_API_URL || "http://evolution:8080";
  const evoApiKey = process.env.EVOLUTION_API_KEY || "";

  queue.enqueue(async () => {
    // Re-check transaction status before sending (may have been paid)
    const { data: tx } = await sb
      .from("transactions")
      .select("status")
      .eq("id", opts.transactionId)
      .maybeSingle();

    if (!tx || tx.status === "aprovado" || tx.status === "reembolsado") {
      await sb.from("recovery_queue").update({ status: "cancelled" }).eq("id", queueId);
      console.log(`[recovery-dispatch] Cancelled — tx ${opts.transactionId} already ${tx?.status || "deleted"}`);
      return;
    }

    const resp = await fetch(`${evoBaseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoApiKey },
      body: JSON.stringify({ number: phone, text: message }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Evolution API ${resp.status}: ${errText}`);
    }

    await sb.from("recovery_queue").update({
      status: "sent",
      sent_at: new Date().toISOString(),
    }).eq("id", queueId);

    console.log(`[recovery-dispatch] Sent recovery to ${opts.customerPhone} (tx: ${opts.transactionId})`);
  }, `recovery:${opts.transactionId}`).catch(async (err: any) => {
    if (queueId) {
      await sb.from("recovery_queue").update({
        status: "failed",
        error_message: err.message?.substring(0, 500),
      }).eq("id", queueId).catch(() => {});
    }
    console.error(`[recovery-dispatch] Failed for ${opts.customerPhone}:`, err.message);
  });
}
