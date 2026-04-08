/**
 * Follow-Up Daily — Processes the "régua de cobrança" daily.
 *
 * For each workspace with followup_settings.enabled=true:
 * 1. Load all pending boletos
 * 2. For each boleto, calculate which recovery rule matches TODAY
 * 3. If not already contacted today for that rule, enqueue message via MessageQueue
 * 4. Record in boleto_recovery_contacts to avoid duplicates
 */

import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { getMessageQueue } from "../lib/message-queue";
import { normalizePhone } from "../lib/normalize-phone";

const router = Router();

function getGreeting(): string {
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brasiliaHour >= 5 && brasiliaHour < 12) return "Bom dia";
  if (brasiliaHour >= 12 && brasiliaHour < 18) return "Boa tarde";
  return "Boa noite";
}

function replaceVariables(
  template: string,
  vars: {
    name: string | null;
    amount: number;
    dueDate: string | null;
    barcode: string | null;
  },
): string {
  const firstName = vars.name ? vars.name.split(" ")[0] : "cliente";
  const fullName = vars.name || "cliente";
  const formattedAmount = `R$ ${vars.amount.toFixed(2).replace(".", ",")}`;
  const formattedDue = vars.dueDate
    ? new Date(vars.dueDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "N/A";

  return template
    .replace(/\{saudação\}/gi, getGreeting())
    .replace(/\{saudacao\}/gi, getGreeting())
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{nome\}/gi, fullName)
    .replace(/\{valor\}/gi, formattedAmount)
    .replace(/\{vencimento\}/gi, formattedDue)
    .replace(/\{codigo_barras\}/gi, vars.barcode || "");
}

/**
 * Strip data URI prefix from base64.
 */
function cleanBase64(input: string): string {
  let cleaned = input.trim();
  if (cleaned.startsWith("data:") && cleaned.includes(",")) {
    cleaned = cleaned.split(",")[1];
  }
  return cleaned.replace(/\s/g, "");
}

/**
 * Get today's date string in Brasília timezone (YYYY-MM-DD).
 */
function getTodayBrasilia(): string {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Calculate days between two dates (ignoring time).
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA.slice(0, 10));
  const b = new Date(dateB.slice(0, 10));
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

interface Rule {
  id: string;
  rule_type: string;
  days: number;
  message: string;
  media_blocks: any[];
  priority: number;
}

/**
 * Find the matching rule for a boleto based on its creation date and due date.
 */
function findMatchingRule(
  rules: Rule[],
  createdAt: string,
  dueDate: string,
  today: string,
): Rule | null {
  const daysSinceGeneration = daysBetween(createdAt, today);
  const daysUntilDue = daysBetween(today, dueDate);
  const daysAfterDue = daysBetween(dueDate, today);

  // Rules are already sorted by priority (ascending = higher priority first)
  for (const rule of rules) {
    switch (rule.rule_type) {
      case "days_after_generation":
        if (daysSinceGeneration === rule.days) return rule;
        break;
      case "days_before_due":
        if (daysUntilDue === rule.days) return rule;
        break;
      case "days_after_due":
        if (daysAfterDue === rule.days) return rule;
        break;
    }
  }
  return null;
}

/**
 * Process follow-up for a single workspace.
 */
async function processWorkspace(
  sb: ReturnType<typeof getServiceClient>,
  workspaceId: string,
  userId: string,
  instanceName: string,
) {
  const today = getTodayBrasilia();
  console.log(`[followup-daily] Processing workspace ${workspaceId} for ${today}`);

  // 1. Load active rules
  const { data: rules } = await sb
    .from("boleto_recovery_rules")
    .select("id, rule_type, days, message, media_blocks, priority")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (!rules || rules.length === 0) {
    console.log(`[followup-daily] No active rules for workspace ${workspaceId}`);
    return { sent: 0, skipped: 0 };
  }

  // 2. Load boleto settings (expiration days)
  const { data: boletoSettings } = await sb
    .from("boleto_settings")
    .select("default_expiration_days")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const expirationDays = boletoSettings?.default_expiration_days || 3;

  // 3. Load pending boletos
  const { data: boletos } = await sb
    .from("transactions")
    .select("id, created_at, customer_name, customer_phone, amount, metadata, external_id")
    .eq("workspace_id", workspaceId)
    .eq("type", "boleto")
    .eq("status", "pendente");

  if (!boletos || boletos.length === 0) {
    console.log(`[followup-daily] No pending boletos for workspace ${workspaceId}`);
    return { sent: 0, skipped: 0 };
  }

  console.log(`[followup-daily] ${boletos.length} pending boletos, ${rules.length} active rules`);

  // 4. Load today's recovery contacts (to avoid duplicates)
  const todayStart = `${today}T00:00:00.000Z`;
  const todayEnd = `${today}T23:59:59.999Z`;
  const { data: todayContacts } = await sb
    .from("boleto_recovery_contacts")
    .select("transaction_id, rule_id")
    .eq("workspace_id", workspaceId)
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);

  const alreadyContacted = new Set(
    (todayContacts || []).map((c: any) => `${c.transaction_id}:${c.rule_id}`),
  );

  // 5. Load message queue config
  let configDelaySeconds = 30;
  let configPauseAfterSends: number | null = null;
  let configPauseMinutes: number | null = null;

  const { data: queueConfig } = await sb
    .from("message_queue_config")
    .select("delay_seconds, pause_after_sends, pause_minutes")
    .eq("workspace_id", workspaceId)
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (queueConfig) {
    configDelaySeconds = queueConfig.delay_seconds || 30;
    configPauseAfterSends = queueConfig.pause_after_sends ?? null;
    configPauseMinutes = queueConfig.pause_minutes ?? null;
  }

  const delayMs = Math.max(configDelaySeconds, 5) * 1000;
  const queue = getMessageQueue(instanceName, delayMs, configPauseAfterSends, configPauseMinutes);

  const evoBaseUrl = process.env.EVOLUTION_API_URL || "http://evolution:8080";
  const evoApiKey = process.env.EVOLUTION_API_KEY || "";

  let sent = 0;
  let skipped = 0;

  for (const boleto of boletos) {
    const createdAt = boleto.created_at;
    const dueDate = new Date(
      new Date(createdAt).getTime() + expirationDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const matchingRule = findMatchingRule(rules as Rule[], createdAt, dueDate, today);

    if (!matchingRule) {
      skipped++;
      continue;
    }

    // Check if already contacted today for this rule
    const key = `${boleto.id}:${matchingRule.id}`;
    if (alreadyContacted.has(key)) {
      skipped++;
      continue;
    }

    // Normalize phone
    const phone = normalizePhone(boleto.customer_phone);
    if (!phone || phone.length < 12) {
      console.log(`[followup-daily] Invalid phone for boleto ${boleto.id}: ${boleto.customer_phone}`);
      skipped++;
      continue;
    }

    const meta = (boleto.metadata as any) || {};
    const barcode = meta.barcode || meta.digitable_line || boleto.external_id || "";

    const vars = {
      name: boleto.customer_name,
      amount: Number(boleto.amount) || 0,
      dueDate,
      barcode,
    };

    // Build message blocks from rule
    const ruleMessage = matchingRule.message;
    const ruleMediaBlocks = Array.isArray(matchingRule.media_blocks) ? matchingRule.media_blocks : [];

    // Compose blocks: text first, then media
    const blocks: Array<{ type: string; content: string }> = [];
    if (ruleMessage && ruleMessage.trim()) {
      blocks.push({ type: "text", content: ruleMessage });
    }
    for (const mb of ruleMediaBlocks) {
      blocks.push(mb);
    }

    if (blocks.length === 0) {
      skipped++;
      continue;
    }

    // Enqueue into the message queue
    const boletoId = boleto.id;
    const ruleId = matchingRule.id;

    queue
      .enqueue(async () => {
        // Re-check status before sending
        const { data: tx } = await sb
          .from("transactions")
          .select("status")
          .eq("id", boletoId)
          .maybeSingle();

        if (!tx || tx.status !== "pendente") {
          console.log(`[followup-daily] Boleto ${boletoId} no longer pending (${tx?.status}), skipping`);
          return;
        }

        console.log(`[followup-daily] Sending ${blocks.length} block(s) to ${phone} for boleto ${boletoId} (rule: ${matchingRule.rule_type} ${matchingRule.days}d)`);

        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];

          if (block.type === "text") {
            const text = replaceVariables(block.content, vars);
            const resp = await fetch(
              `${evoBaseUrl}/message/sendText/${encodeURIComponent(instanceName)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoApiKey },
                body: JSON.stringify({ number: phone, text }),
              },
            );
            if (!resp.ok) {
              throw new Error(`Evolution sendText ${resp.status}: ${await resp.text()}`);
            }
          } else if (block.type === "pdf") {
            // Send PDF from file
            const boletoFile = meta.boleto_file as string | undefined;
            if (boletoFile) {
              const fsModule = await import("fs/promises");
              const fsPath = boletoFile.replace("/media/", "/media-files/");
              try {
                const pdfBuffer = await fsModule.readFile(fsPath);
                const pdfBase64 = cleanBase64(pdfBuffer.toString("base64"));
                const firstName = vars.name ? vars.name.split(" ")[0] : "cliente";
                const resp = await fetch(
                  `${evoBaseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: evoApiKey },
                    body: JSON.stringify({
                      number: phone,
                      mediatype: "document",
                      media: pdfBase64,
                      fileName: `boleto-${firstName}.pdf`,
                      mimetype: "application/pdf",
                    }),
                  },
                );
                if (!resp.ok) throw new Error(`Evolution PDF ${resp.status}: ${await resp.text()}`);
              } catch (e: any) {
                console.warn(`[followup-daily] PDF block failed for ${boletoId}: ${e.message}`);
              }
            }
          } else if (block.type === "image") {
            const boletoFile = meta.boleto_file as string | undefined;
            if (boletoFile) {
              const fsModule = await import("fs/promises");
              const fsPath = boletoFile.replace("/media/", "/media-files/");
              const jpgPath = fsPath.replace(/\.pdf$/i, ".jpg");
              try {
                try {
                  await fsModule.access(jpgPath);
                } catch {
                  const { exec } = await import("child_process");
                  const { promisify } = await import("util");
                  const execPromise = promisify(exec);
                  const prefix = jpgPath.replace(/\.jpg$/i, "");
                  await execPromise(`pdftoppm -jpeg -singlefile -r 200 "${fsPath}" "${prefix}"`);
                }
                const imgBuffer = await fsModule.readFile(jpgPath);
                const imgBase64 = cleanBase64(imgBuffer.toString("base64"));
                const resp = await fetch(
                  `${evoBaseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: evoApiKey },
                    body: JSON.stringify({
                      number: phone,
                      mediatype: "image",
                      media: imgBase64,
                      caption: "",
                    }),
                  },
                );
                if (!resp.ok) throw new Error(`Evolution Image ${resp.status}: ${await resp.text()}`);
              } catch (e: any) {
                console.warn(`[followup-daily] Image block failed for ${boletoId}: ${e.message}`);
              }
            }
          }

          // Delay between blocks
          if (i < blocks.length - 1) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }

        // Record contact as sent
        await sb.from("boleto_recovery_contacts").insert({
          workspace_id: workspaceId,
          user_id: userId,
          transaction_id: boletoId,
          rule_id: ruleId,
          notes: `followup-daily: ${matchingRule.rule_type} ${matchingRule.days}d`,
        });

        console.log(`[followup-daily] ✅ Sent follow-up for boleto ${boletoId} (rule: ${matchingRule.name})`);
      }, `followup:${boletoId}:${ruleId}`)
      .catch((err: any) => {
        console.error(`[followup-daily] ❌ Failed follow-up for boleto ${boletoId}: ${err.message}`);
      });

    sent++;
  }

  console.log(`[followup-daily] Workspace ${workspaceId}: enqueued=${sent}, skipped=${skipped}`);
  return { sent, skipped };
}

/**
 * Main entry point — process all enabled workspaces.
 */
export async function processFollowUpDaily() {
  const sb = getServiceClient();

  const { data: allSettings } = await sb
    .from("followup_settings")
    .select("workspace_id, user_id, instance_name, send_at_hour, enabled")
    .eq("enabled", true);

  if (!allSettings || allSettings.length === 0) {
    return { processed: 0 };
  }

  let totalSent = 0;
  let totalSkipped = 0;

  for (const setting of allSettings) {
    if (!setting.instance_name) {
      console.log(`[followup-daily] Workspace ${setting.workspace_id} has no instance configured, skipping`);
      continue;
    }

    try {
      const result = await processWorkspace(
        sb,
        setting.workspace_id,
        setting.user_id,
        setting.instance_name,
      );
      if (result) {
        totalSent += result.sent;
        totalSkipped += result.skipped;
      }
    } catch (err: any) {
      console.error(`[followup-daily] Error processing workspace ${setting.workspace_id}: ${err.message}`);
    }
  }

  return { processed: allSettings.length, sent: totalSent, skipped: totalSkipped };
}

// Manual trigger endpoint
router.post("/process", async (_req, res) => {
  try {
    const result = await processFollowUpDaily();
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error(`[followup-daily] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
