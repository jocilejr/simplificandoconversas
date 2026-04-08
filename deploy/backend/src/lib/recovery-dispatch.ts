/**
 * Recovery Dispatch — Event-driven recovery sender.
 *
 * Called immediately after a transaction is saved/updated to pending.
 * Uses the global MessageQueue for anti-ban serialization.
 * Writes audit trail to recovery_queue.
 *
 * RULES — Each transaction type is INDEPENDENT:
 * - Boleto: Uses multi-block template from boleto_recovery_templates (is_default=true). NO fallback.
 * - PIX/Cartão: Uses single text message from profiles.recovery_message_pix.
 * - Rejeitado/Abandonado: Uses single text message from profiles.recovery_message_abandoned.
 * - No type ever reads the other's configuration.
 */

import { getServiceClient } from "./supabase";
import { getMessageQueue } from "./message-queue";

interface RecoveryBlock {
  id: string;
  type: "text" | "pdf" | "image";
  content: string;
}

/**
 * Strip data URI prefix and whitespace from base64 strings.
 * Evolution API expects raw base64, not data URIs.
 */
function cleanBase64(input: string): string {
  let cleaned = input.trim();
  if (cleaned.startsWith("data:") && cleaned.includes(",")) {
    cleaned = cleaned.split(",")[1];
  }
  return cleaned.replace(/\s/g, "");
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

// Re-export from shared utility (kept as local alias for backward compat)
import { normalizePhone } from "./normalize-phone";

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
    console.log(`[recovery-dispatch] Sending TEXT block to ${phone}`);
    const resp = await fetch(`${evoBaseUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
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
    // Send the actual PDF document via local file + base64
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

    const fsModule = await import("fs/promises");
    const fsPath = boletoFile.replace("/media/", "/media-files/");

    try {
      await fsModule.access(fsPath);
    } catch {
      console.log(`[recovery-dispatch] PDF file not found on disk: ${fsPath}, skipping PDF block`);
      return;
    }

    const pdfBuffer = await fsModule.readFile(fsPath);
    const pdfBase64 = cleanBase64(pdfBuffer.toString("base64"));

    const firstName = vars.name ? vars.name.split(" ")[0] : "cliente";
    const fileName = `boleto-${firstName}.pdf`;

    console.log(`[recovery-dispatch] Sending PDF block from ${fsPath} (${pdfBase64.length} chars base64)`);
    const resp = await fetch(`${evoBaseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoApiKey },
      body: JSON.stringify({
        number: phone,
        mediatype: "document",
        media: pdfBase64,
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
    // Convert boleto PDF to JPG locally and send as base64
    const { data: tx } = await sb
      .from("transactions")
      .select("metadata")
      .eq("id", transactionId)
      .maybeSingle();

    const meta = (tx?.metadata as any) || {};
    if (!meta.boleto_file) {
      console.log(`[recovery-dispatch] No PDF file for tx ${transactionId}, skipping IMAGE block`);
      return;
    }

    const fsModule = await import("fs/promises");
    const boletoFile = meta.boleto_file as string;
    const fsPath = boletoFile.replace("/media/", "/media-files/");
    const jpgPath = fsPath.replace(/\.pdf$/i, ".jpg");

    // Check cache or convert
    try {
      await fsModule.access(jpgPath);
      console.log(`[recovery-dispatch] JPG cache hit: ${jpgPath}`);
    } catch {
      // Verify PDF exists
      try {
        await fsModule.access(fsPath);
      } catch {
        console.log(`[recovery-dispatch] PDF not found on disk: ${fsPath}, skipping IMAGE block`);
        return;
      }
      // Convert PDF → JPG via pdftoppm
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execPromise = promisify(exec);
      const prefix = jpgPath.replace(/\.jpg$/i, "");
      console.log(`[recovery-dispatch] Converting PDF→JPG: pdftoppm -jpeg -singlefile -r 200 "${fsPath}" "${prefix}"`);
      await execPromise(`pdftoppm -jpeg -singlefile -r 200 "${fsPath}" "${prefix}"`);
    }

    const imgBuffer = await fsModule.readFile(jpgPath);
    const imgBase64 = cleanBase64(imgBuffer.toString("base64"));

    console.log(`[recovery-dispatch] Sending IMAGE block from ${jpgPath} (${imgBase64.length} chars base64)`);
    const resp = await fetch(`${evoBaseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoApiKey },
      body: JSON.stringify({
        number: phone,
        mediatype: "image",
        media: imgBase64,
        caption: "",
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[recovery-dispatch] Evolution sendMedia/image error ${resp.status}: ${errText}`);
      throw new Error(`Evolution API Image ${resp.status}: ${errText}`);
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
  skipDuplicateCheck?: boolean;
}) {
  console.log(`[recovery-dispatch] START tx=${opts.transactionId} type=${opts.transactionType} phone=${opts.customerPhone}`);

  if (!opts.customerPhone) {
    console.log(`[recovery-dispatch] SKIP — no phone for tx ${opts.transactionId}`);
    return;
  }

  const sb = getServiceClient();
  const txType = opts.transactionType;

  // 1. Load recovery_settings
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

  // 3. Check duplicate (skip if retrying from manual process)
  if (!opts.skipDuplicateCheck) {
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

  // 6. Load template/message based on transaction type — EACH TYPE IS INDEPENDENT
  let blocks: RecoveryBlock[] = [];

  if (txType === "boleto") {
    // Boleto: use multi-block template from boleto_recovery_templates (absolute, no fallback)
    const { data: defaultTemplate } = await sb
      .from("boleto_recovery_templates")
      .select("blocks")
      .eq("workspace_id", opts.workspaceId)
      .eq("is_default", true)
      .maybeSingle();

    blocks =
      defaultTemplate && Array.isArray(defaultTemplate.blocks) && defaultTemplate.blocks.length > 0
        ? (defaultTemplate.blocks as RecoveryBlock[])
        : [];

    if (blocks.length === 0) {
      console.log(`[recovery-dispatch] FAIL — No default boleto template for workspace ${opts.workspaceId}.`);
      await sb.from("recovery_queue").insert({
        workspace_id: opts.workspaceId,
        user_id: opts.userId,
        transaction_id: opts.transactionId,
        customer_phone: normalizedPhone,
        customer_name: opts.customerName || null,
        amount: opts.amount,
        transaction_type: txType,
        status: "failed",
        error_message: "Nenhum template padrão de boleto configurado. Configure um template com is_default=true.",
        scheduled_at: new Date().toISOString(),
      });
      return;
    }
  } else {
    // PIX/Cartão or Rejected/Abandoned: load single text message from profiles — NO FALLBACK
    const fieldKey = (txType === "yampi_cart" || txType === "yampi")
      ? "recovery_message_abandoned"
      : "recovery_message_pix";

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("recovery_message_pix, recovery_message_abandoned")
      .eq("user_id", opts.userId)
      .maybeSingle();

    if (profileError) {
      console.error(`[recovery-dispatch] Profile query error for user ${opts.userId}: ${profileError.message}`);
    }

    const message = (profile as any)?.[fieldKey];
    console.log(`[recovery-dispatch] Profile loaded for user ${opts.userId}: field=${fieldKey}, hasMessage=${!!message}, messageLength=${message?.length || 0}`);

    if (!message || !message.trim()) {
      console.log(`[recovery-dispatch] FAIL — No ${fieldKey} message configured for user ${opts.userId}. Configure via modal.`);
      await sb.from("recovery_queue").insert({
        workspace_id: opts.workspaceId,
        user_id: opts.userId,
        transaction_id: opts.transactionId,
        customer_phone: normalizedPhone,
        customer_name: opts.customerName || null,
        amount: opts.amount,
        transaction_type: txType,
        status: "failed",
        error_message: `Nenhuma mensagem de recuperação configurada para ${fieldKey}. Configure no modal de configuração.`,
        scheduled_at: new Date().toISOString(),
      });
      return;
    }

    blocks = [{ id: "profile-text", type: "text", content: message }];
  }

  console.log(`[recovery-dispatch] Default template loaded: ${blocks.length} block(s) [${blocks.map(b => b.type).join(", ")}]`);

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
  let configDelaySeconds = 30;
  let configPauseAfterSends: number | null = null;
  let configPauseMinutes: number | null = null;
  try {
    const { data: queueConfig, error: queueConfigError } = await sb
      .from("message_queue_config")
      .select("delay_seconds, pause_after_sends, pause_minutes")
      .eq("workspace_id", opts.workspaceId)
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (queueConfigError) {
      console.warn(`[recovery-dispatch] message_queue_config query error: ${queueConfigError.message} — using default 30s`);
    } else if (queueConfig) {
      if (queueConfig.delay_seconds) configDelaySeconds = queueConfig.delay_seconds;
      configPauseAfterSends = queueConfig.pause_after_sends ?? null;
      configPauseMinutes = queueConfig.pause_minutes ?? null;
    }
  } catch (err: any) {
    console.warn(`[recovery-dispatch] message_queue_config query failed: ${err.message} — using default 30s`);
  }

  const delayMs = Math.max(configDelaySeconds, 5) * 1000;
  console.log(`[recovery-dispatch] Queue delay: ${delayMs}ms (config: ${configDelaySeconds}s), cooldown: after=${configPauseAfterSends} pause=${configPauseMinutes}min for instance: ${instanceName}`);

  // 9. Enqueue into the global message queue for this instance
  const queue = getMessageQueue(instanceName, delayMs, configPauseAfterSends, configPauseMinutes);

  const evoBaseUrl = process.env.EVOLUTION_API_URL || "http://evolution:8080";
  const evoApiKey = process.env.EVOLUTION_API_KEY || "";

  const vars = { name: opts.customerName, amount: opts.amount };

  queue.enqueue(async () => {
    // Re-check transaction status before sending
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

    console.log(`[recovery-dispatch] Sending ${blocks.length} block(s) to ${normalizedPhone} via ${instanceName} (delay between blocks: ${delayMs}ms)`);

    // Send each block sequentially with the CONFIGURED delay between them
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      console.log(`[recovery-dispatch] Block ${i + 1}/${blocks.length}: type=${block.type}`);
      await sendBlock(block, vars, normalizedPhone, instanceName!, evoBaseUrl, evoApiKey, opts.transactionId, sb);

      // Use the configured delay between blocks (not a hardcoded 2s)
      if (i < blocks.length - 1) {
        console.log(`[recovery-dispatch] Waiting ${delayMs}ms before next block...`);
        await new Promise((r) => setTimeout(r, delayMs));
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

/**
 * Check if a phone number exists on WhatsApp via Evolution API.
 * Returns true/false or null if check fails.
 */
export async function checkWhatsAppNumber(
  phone: string,
  instanceName: string,
): Promise<boolean | null> {
  const evoBaseUrl = process.env.EVOLUTION_API_URL || "http://evolution:8080";
  const evoApiKey = process.env.EVOLUTION_API_KEY || "";

  if (!phone || !instanceName || !evoApiKey) return null;

  try {
    const resp = await fetch(
      `${evoBaseUrl}/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoApiKey },
        body: JSON.stringify({ numbers: [phone] }),
      }
    );

    if (!resp.ok) {
      console.warn(`[whatsapp-check] Evolution API ${resp.status} for ${phone}`);
      return null;
    }

    const result: any = await resp.json();
    // Evolution v2 returns array: [{ exists: true, jid: "..." }]
    if (Array.isArray(result) && result.length > 0) {
      return !!result[0].exists;
    }
    return null;
  } catch (err: any) {
    console.warn(`[whatsapp-check] Error checking ${phone}: ${err.message}`);
    return null;
  }
}
