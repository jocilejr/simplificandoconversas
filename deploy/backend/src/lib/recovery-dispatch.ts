/**
 * Recovery Dispatch — Event-driven recovery sender.
 *
 * Called immediately after a transaction is saved/updated to pending.
 * Uses the global MessageQueue for anti-ban serialization.
 * Writes audit trail to recovery_queue.
 * Supports block-based templates (text, PDF, image) from boleto_recovery_templates.
 */

import { getServiceClient } from "./supabase";
import { getMessageQueue } from "./message-queue";

interface RecoveryBlock {
  id: string;
  type: "text" | "pdf" | "image";
  content: string;
}

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
 * Normalize phone number to Brazilian format for Evolution API.
 */
function normalizePhone(raw: string): string {
  let phone = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith("55")) {
    phone = "55" + phone;
  }
  return phone;
}

/**
 * Send a single block via Evolution API.
 */
async function sendBlock(
  block: RecoveryBlock,
  vars: { name: string | null; amount: number },
  phone: string,
  instanceName: string,
  evoBaseUrl: string,
  evoApiKey: string,
  transactionId: string,
  sb: ReturnType<typeof getServiceClient>,
): Promise<void> {
  if (block.type === "text") {
    const text = replaceVariables(block.content, vars);
    console.log(`[recovery-dispatch] Sending text block to ${phone}`);
    const resp = await fetch(`${evoBaseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoApiKey },
      body: JSON.stringify({ number: phone, text }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[recovery-dispatch] Evolution sendText error ${resp.status}: ${errText}`);
      throw new Error(`Evolution API ${resp.status}: ${errText}`);
    }
  } else if (block.type === "pdf") {
    // Get the PDF URL from the transaction metadata
    const { data: tx } = await sb
      .from("transactions")
      .select("metadata, external_id")
      .eq("id", transactionId)
      .maybeSingle();

    const meta = (tx?.metadata as any) || {};
    const boletoFile = meta.boleto_file as string | undefined;

    if (!boletoFile) {
      console.log(`[recovery-dispatch] No PDF file for tx ${transactionId}, skipping PDF block`);
      return;
    }

    // Build a public URL for the PDF via the backend endpoint
    const appPublicUrl = process.env.APP_PUBLIC_URL || "";
    if (!appPublicUrl) {
      console.log(`[recovery-dispatch] APP_PUBLIC_URL not set, skipping PDF block`);
      return;
    }

    const pdfUrl = `${appPublicUrl}/api/payment/boleto-pdf/${transactionId}`;
    const firstName = vars.name ? vars.name.split(" ")[0] : "cliente";
    const fileName = `boleto-${firstName}.pdf`;

    console.log(`[recovery-dispatch] Sending PDF block: ${pdfUrl}`);
    const resp = await fetch(`${evoBaseUrl}/message/sendMedia/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoApiKey },
      body: JSON.stringify({
        number: phone,
        mediatype: "document",
        media: pdfUrl,
        fileName,
        mimetype: "application/pdf",
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[recovery-dispatch] Evolution sendMedia/PDF error ${resp.status}: ${errText}`);
      throw new Error(`Evolution API PDF ${resp.status}: ${errText}`);
    }
  } else if (block.type === "image") {
    // Image block — if it has content (URL), send it
    if (block.content) {
      console.log(`[recovery-dispatch] Sending image block: ${block.content}`);
      const resp = await fetch(`${evoBaseUrl}/message/sendMedia/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoApiKey },
        body: JSON.stringify({
          number: phone,
          mediatype: "image",
          media: block.content,
          caption: "",
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[recovery-dispatch] Evolution sendMedia/image error ${resp.status}: ${errText}`);
        throw new Error(`Evolution API Image ${resp.status}: ${errText}`);
      }
    } else {
      console.log(`[recovery-dispatch] Image block has no content URL, skipping`);
    }
  }
}

/**
 * Dispatch recovery for a single transaction immediately.
 */
export async function dispatchRecovery(opts: {
  workspaceId: string;
  userId: string;
  transactionId: string;
  customerPhone: string | null;
  customerName: string | null;
  amount: number;
  transactionType: string;
}) {
  console.log(`[recovery-dispatch] START tx=${opts.transactionId} type=${opts.transactionType} phone=${opts.customerPhone}`);

  if (!opts.customerPhone) {
    console.log(`[recovery-dispatch] SKIP — no phone for tx ${opts.transactionId}`);
    return;
  }

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

  console.log(`[recovery-dispatch] Settings: enabled_boleto=${settings.enabled_boleto} enabled_pix=${settings.enabled_pix} enabled_yampi=${settings.enabled_yampi}`);

  // 2. Check per-type enablement
  if (txType === "boleto" && !settings.enabled_boleto) {
    console.log(`[recovery-dispatch] SKIP — boleto not enabled`);
    return;
  } else if ((txType === "yampi_cart" || txType === "yampi") && !settings.enabled_yampi) {
    console.log(`[recovery-dispatch] SKIP — yampi not enabled`);
    return;
  } else if (txType !== "boleto" && txType !== "yampi_cart" && txType !== "yampi" && !settings.enabled_pix) {
    console.log(`[recovery-dispatch] SKIP — pix not enabled`);
    return;
  }

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

  console.log(`[recovery-dispatch] Instance: ${instanceName}`);

  // 5. Normalize phone
  const normalizedPhone = normalizePhone(opts.customerPhone);
  console.log(`[recovery-dispatch] Phone: "${opts.customerPhone}" → "${normalizedPhone}"`);

  if (normalizedPhone.length < 12) {
    console.log(`[recovery-dispatch] INVALID phone: "${normalizedPhone}" (too short)`);
    await sb.from("recovery_queue").insert({
      workspace_id: opts.workspaceId,
      user_id: opts.userId,
      transaction_id: opts.transactionId,
      customer_phone: normalizedPhone,
      customer_name: opts.customerName || null,
      amount: opts.amount,
      transaction_type: txType,
      status: "failed",
      error_message: `Invalid phone after normalization: ${normalizedPhone}`,
      scheduled_at: new Date().toISOString(),
    });
    return;
  }

  // 6. Load template blocks from boleto_recovery_templates (default template)
  let blocks: RecoveryBlock[] = [];

  const { data: defaultTemplate } = await sb
    .from("boleto_recovery_templates")
    .select("blocks")
    .eq("workspace_id", opts.workspaceId)
    .eq("is_default", true)
    .maybeSingle();

  if (defaultTemplate && Array.isArray(defaultTemplate.blocks) && defaultTemplate.blocks.length > 0) {
    blocks = defaultTemplate.blocks as RecoveryBlock[];
    console.log(`[recovery-dispatch] Using default template with ${blocks.length} blocks`);
  } else {
    // Fallback: try first template
    const { data: anyTemplate } = await sb
      .from("boleto_recovery_templates")
      .select("blocks")
      .eq("workspace_id", opts.workspaceId)
      .limit(1)
      .maybeSingle();

    if (anyTemplate && Array.isArray(anyTemplate.blocks) && anyTemplate.blocks.length > 0) {
      blocks = anyTemplate.blocks as RecoveryBlock[];
      console.log(`[recovery-dispatch] Using first available template with ${blocks.length} blocks`);
    }
  }

  // If no template blocks found, fall back to legacy profiles message
  if (blocks.length === 0) {
    console.log(`[recovery-dispatch] No template blocks found, using legacy profiles message`);
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

    blocks = [{ id: "legacy", type: "text", content: template }];
  }

  // 7. Insert audit record as pending
  const { data: queueItem } = await sb
    .from("recovery_queue")
    .insert({
      workspace_id: opts.workspaceId,
      user_id: opts.userId,
      transaction_id: opts.transactionId,
      customer_phone: normalizedPhone,
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

  const vars = { name: opts.customerName, amount: opts.amount };

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

    console.log(`[recovery-dispatch] Sending ${blocks.length} block(s) to ${normalizedPhone} via ${instanceName}`);

    // Send each block sequentially with a small delay between them
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      console.log(`[recovery-dispatch] Block ${i + 1}/${blocks.length}: type=${block.type}`);
      await sendBlock(block, vars, normalizedPhone, instanceName!, evoBaseUrl, evoApiKey, opts.transactionId, sb);

      // Small delay between blocks (2s) to avoid rate limiting
      if (i < blocks.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    await sb.from("recovery_queue").update({
      status: "sent",
      sent_at: new Date().toISOString(),
    }).eq("id", queueId);

    console.log(`[recovery-dispatch] ✅ Sent ${blocks.length} block(s) to ${normalizedPhone} (tx: ${opts.transactionId})`);
  }, `recovery:${opts.transactionId}`).catch(async (err: any) => {
    if (queueId) {
      try {
        await sb.from("recovery_queue").update({
          status: "failed",
          error_message: err.message?.substring(0, 500),
        }).eq("id", queueId);
      } catch (_) {}
    }
    console.error(`[recovery-dispatch] ❌ Failed for ${normalizedPhone}:`, err.message);
  });
}
