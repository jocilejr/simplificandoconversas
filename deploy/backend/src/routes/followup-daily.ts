import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { getMessageQueue } from "../lib/message-queue";
import { normalizePhone } from "../lib/normalize-phone";

const router = Router();

const FOLLOWUP_QUEUE_TABLE = "followup_dispatch_queue" as any;

// ─── Types ───

interface Rule {
  id: string;
  name?: string;
  rule_type: string;
  days: number;
  message: string;
  media_blocks: any[];
  priority: number;
}

interface WorkspaceSetting {
  workspace_id: string;
  user_id: string;
  instance_name: string | null;
  send_at_hour?: string | null;
  enabled?: boolean;
  max_messages_per_phone_per_day?: number | null;
}

interface BoletoRow {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  amount: number;
  metadata: any;
  external_id: string | null;
}

interface FollowUpBlock {
  type: string;
  content?: string;
}

interface FollowUpQueueRow {
  id: string;
  workspace_id: string;
  user_id: string;
  transaction_id: string;
  rule_id: string;
  instance_name: string;
  phone: string | null;
  normalized_phone: string | null;
  customer_name: string | null;
  amount: number;
  barcode: string | null;
  boleto_file: string | null;
  due_date: string | null;
  dispatch_date: string;
  message_snapshot: string | null;
  blocks_snapshot: FollowUpBlock[];
  status: string;
  last_error: string | null;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ───

function getGreeting(): string {
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brasiliaHour >= 5 && brasiliaHour < 12) return "Bom dia";
  if (brasiliaHour >= 12 && brasiliaHour < 18) return "Boa tarde";
  return "Boa noite";
}

function normalizeDueDateForMessage(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00-03:00`;
  return value;
}

function replaceVariables(
  template: string,
  vars: { name: string | null; amount: number; dueDate: string | null; barcode: string | null },
): string {
  const firstName = vars.name ? vars.name.split(" ")[0] : "cliente";
  const fullName = vars.name || "cliente";
  const formattedAmount = `R$ ${vars.amount.toFixed(2).replace(".", ",")}`;
  const dueDateValue = normalizeDueDateForMessage(vars.dueDate);
  const formattedDue = dueDateValue
    ? new Date(dueDateValue).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
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

function cleanBase64(input: string): string {
  let cleaned = input.trim();
  if (cleaned.startsWith("data:") && cleaned.includes(",")) cleaned = cleaned.split(",")[1];
  return cleaned.replace(/\s/g, "");
}

function getTodayBrasilia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA.slice(0, 10));
  const b = new Date(dateB.slice(0, 10));
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function findMatchingRule(rules: Rule[], createdAt: string, dueDate: string, today: string): Rule | null {
  const daysSinceGeneration = daysBetween(createdAt, today);
  const daysUntilDue = daysBetween(today, dueDate);
  const daysAfterDue = daysBetween(dueDate, today);
  for (const rule of rules) {
    switch (rule.rule_type) {
      case "days_after_generation": if (daysSinceGeneration === rule.days) return rule; break;
      case "days_before_due": if (daysUntilDue === rule.days) return rule; break;
      case "days_after_due": if (daysAfterDue === rule.days) return rule; break;
    }
  }
  return null;
}

function buildBlocks(rule: Rule): FollowUpBlock[] {
  const blocks: FollowUpBlock[] = [];
  if (rule.message?.trim()) blocks.push({ type: "text", content: rule.message });
  const mediaBlocks = Array.isArray(rule.media_blocks) ? rule.media_blocks : [];
  for (const block of mediaBlocks) {
    if (block && typeof block === "object" && typeof block.type === "string") blocks.push(block as FollowUpBlock);
  }
  return blocks;
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function markQueueJob(sb: ReturnType<typeof getServiceClient>, jobId: string, values: Record<string, any>) {
  const { error } = await sb.from(FOLLOWUP_QUEUE_TABLE).update({ ...values, updated_at: new Date().toISOString() }).eq("id", jobId);
  if (error) throw error;
}

async function upsertDispatchJob(sb: ReturnType<typeof getServiceClient>, payload: Record<string, any>) {
  const { error } = await sb.from(FOLLOWUP_QUEUE_TABLE).upsert(payload, { onConflict: "workspace_id,transaction_id,rule_id,dispatch_date" });
  if (error) throw error;
}

// ════════════════════════════════════════════════════════════════════
// FASE 1 — PREPARAÇÃO (chamado pelo cron 00:01 BRT ou manualmente)
// ════════════════════════════════════════════════════════════════════

async function prepareWorkspace(
  sb: ReturnType<typeof getServiceClient>,
  setting: WorkspaceSetting,
): Promise<{ prepared: number; skippedDuplicate: number; skippedInvalidPhone: number; skippedNoRule: number; skippedNoBlocks: number }> {
  const today = getTodayBrasilia();
  const result = { prepared: 0, skippedDuplicate: 0, skippedInvalidPhone: 0, skippedNoRule: 0, skippedNoBlocks: 0 };

  if (!setting.instance_name) return result;

  // 1. Delete old jobs (previous days)
  await sb.from(FOLLOWUP_QUEUE_TABLE).delete().eq("workspace_id", setting.workspace_id).lt("dispatch_date", today);

  // 2. Load rules + boletos + boleto settings
  const [rulesResult, boletoSettingsResult, boletosResult, existingJobsResult] = await Promise.all([
    sb.from("boleto_recovery_rules").select("id, name, rule_type, days, message, media_blocks, priority")
      .eq("workspace_id", setting.workspace_id).eq("is_active", true).neq("rule_type", "immediate")
      .order("priority", { ascending: true }),
    sb.from("boleto_settings").select("default_expiration_days")
      .eq("workspace_id", setting.workspace_id).maybeSingle(),
    sb.from("transactions").select("id, created_at, customer_name, customer_phone, customer_document, amount, metadata, external_id")
      .eq("workspace_id", setting.workspace_id).eq("type", "boleto").eq("status", "pendente")
      .order("created_at", { ascending: true }),
    sb.from(FOLLOWUP_QUEUE_TABLE).select("transaction_id, rule_id, status")
      .eq("workspace_id", setting.workspace_id).eq("dispatch_date", today),
  ]);

  const rules = (rulesResult.data || []) as Rule[];
  const boletos = (boletosResult.data || []) as BoletoRow[];
  const expirationDays = (boletoSettingsResult.data as any)?.default_expiration_days || 7;

  if (rules.length === 0 || boletos.length === 0) return result;

  // Build set of existing jobs to avoid re-inserting already sent/processed ones
  const existingJobKeys = new Set<string>();
  for (const job of (existingJobsResult.data || []) as any[]) {
    existingJobKeys.add(`${job.transaction_id}:${job.rule_id}`);
  }

  // 3. Apply rules to each boleto, collect matches
  interface MatchedBoleto {
    boleto: BoletoRow;
    rule: Rule;
    dueDate: string;
    normalized: string | null;
    cpf: string | null;
    blocks: FollowUpBlock[];
  }
  const matches: MatchedBoleto[] = [];

  for (const boleto of boletos) {
    const dueDate = new Date(new Date(boleto.created_at).getTime() + expirationDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const matchingRule = findMatchingRule(rules, boleto.created_at, dueDate, today);
    if (!matchingRule) { result.skippedNoRule++; continue; }

    const key = `${boleto.id}:${matchingRule.id}`;
    if (existingJobKeys.has(key)) continue; // already exists today, don't touch

    const blocks = buildBlocks(matchingRule);
    if (blocks.length === 0) { result.skippedNoBlocks++; continue; }

    const normalized = normalizePhone(boleto.customer_phone);
    const cpf = boleto.customer_document?.replace(/\D/g, "") || null;

    matches.push({ boleto, rule: matchingRule, dueDate, normalized, cpf: cpf && cpf.length >= 11 ? cpf : null, blocks });
  }

  // 4. CPF deduplication: keep first per CPF as pending, rest as skipped_duplicate
  const cpfSeen = new Set<string>();
  const toInsert: Record<string, any>[] = [];

  for (const m of matches) {
    const meta = (m.boleto.metadata as any) || {};
    const barcode = meta.barcode || meta.digitable_line || m.boleto.external_id || "";
    const basePayload = {
      workspace_id: setting.workspace_id,
      user_id: setting.user_id,
      transaction_id: m.boleto.id,
      rule_id: m.rule.id,
      instance_name: setting.instance_name,
      phone: m.normalized,
      normalized_phone: m.normalized,
      customer_name: m.boleto.customer_name,
      amount: Number(m.boleto.amount) || 0,
      barcode,
      boleto_file: meta.boleto_file || null,
      due_date: m.dueDate,
      dispatch_date: today,
      message_snapshot: m.rule.message || null,
      blocks_snapshot: m.blocks,
      updated_at: new Date().toISOString(),
    };

    // Invalid phone
    if (!m.normalized || m.normalized.length < 12) {
      toInsert.push({
        ...basePayload,
        status: "skipped_invalid_phone",
        last_error: "Telefone inválido ou incompleto",
        completed_at: new Date().toISOString(),
      });
      result.skippedInvalidPhone++;
      continue;
    }

    // CPF duplicate
    if (m.cpf && cpfSeen.has(m.cpf)) {
      toInsert.push({
        ...basePayload,
        status: "skipped_duplicate",
        last_error: `CPF duplicado: ${m.cpf}`,
        completed_at: new Date().toISOString(),
      });
      result.skippedDuplicate++;
      continue;
    }
    if (m.cpf) cpfSeen.add(m.cpf);

    // Valid — pending
    toInsert.push({
      ...basePayload,
      status: "pending",
      last_error: null,
      started_at: null,
      completed_at: null,
    });
    result.prepared++;
  }

  // 5. Bulk upsert
  for (const payload of toInsert) {
    await upsertDispatchJob(sb, payload);
  }

  return result;
}

export async function prepareFollowUpDaily(workspaceIds?: string[]) {
  const sb = getServiceClient();

  let settingsQuery = sb.from("followup_settings")
    .select("workspace_id, user_id, instance_name, send_at_hour, enabled, max_messages_per_phone_per_day")
    .eq("enabled", true);
  if (workspaceIds && workspaceIds.length > 0) {
    settingsQuery = sb.from("followup_settings")
      .select("workspace_id, user_id, instance_name, send_at_hour, enabled, max_messages_per_phone_per_day")
      .in("workspace_id", workspaceIds);
  }

  const { data: allSettings, error } = await settingsQuery;
  if (error) throw error;
  if (!allSettings || allSettings.length === 0) return { workspaces: 0, prepared: 0, skippedDuplicate: 0, skippedInvalidPhone: 0 };

  let totalPrepared = 0, totalDup = 0, totalInvalid = 0;
  for (const setting of allSettings as WorkspaceSetting[]) {
    try {
      const r = await prepareWorkspace(sb, setting);
      totalPrepared += r.prepared;
      totalDup += r.skippedDuplicate;
      totalInvalid += r.skippedInvalidPhone;
      if (r.prepared > 0 || r.skippedDuplicate > 0 || r.skippedInvalidPhone > 0) {
        console.log(`[followup-prepare] Workspace ${setting.workspace_id}: prepared=${r.prepared}, dup=${r.skippedDuplicate}, invalid=${r.skippedInvalidPhone}, noRule=${r.skippedNoRule}`);
      }
    } catch (err: any) {
      console.error(`[followup-prepare] Error workspace ${setting.workspace_id}: ${err.message}`);
    }
  }

  console.log(`[followup-prepare] Total: ${allSettings.length} workspace(s), ${totalPrepared} prepared, ${totalDup} duplicates, ${totalInvalid} invalid phones`);
  return { workspaces: allSettings.length, prepared: totalPrepared, skippedDuplicate: totalDup, skippedInvalidPhone: totalInvalid };
}

// ════════════════════════════════════════════════════════════════════
// FASE 2 — ENVIO (chamado pelo cron no send_at_hour ou manualmente)
// ════════════════════════════════════════════════════════════════════

async function dispatchJob(job: FollowUpQueueRow, delayMs: number) {
  const evoBaseUrl = process.env.EVOLUTION_API_URL || "http://evolution:8080";
  const evoApiKey = process.env.EVOLUTION_API_KEY || "";
  const blocks = Array.isArray(job.blocks_snapshot) ? job.blocks_snapshot : [];
  const vars = { name: job.customer_name, amount: Number(job.amount) || 0, dueDate: job.due_date, barcode: job.barcode };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === "text") {
      const text = replaceVariables(block.content || "", vars);
      const resp = await fetchWithTimeout(
        `${evoBaseUrl}/message/sendText/${encodeURIComponent(job.instance_name)}`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: evoApiKey }, body: JSON.stringify({ number: job.normalized_phone, text }) },
      );
      if (!resp.ok) throw new Error(`Evolution sendText ${resp.status}: ${await resp.text()}`);
    } else if (block.type === "pdf") {
      if (!job.boleto_file) continue;
      const fsModule = await import("fs/promises");
      const fsPath = job.boleto_file.replace("/media/", "/media-files/");
      const pdfBuffer = await fsModule.readFile(fsPath);
      const pdfBase64 = cleanBase64(pdfBuffer.toString("base64"));
      const firstName = vars.name ? vars.name.split(" ")[0] : "cliente";
      const resp = await fetchWithTimeout(
        `${evoBaseUrl}/message/sendMedia/${encodeURIComponent(job.instance_name)}`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: evoApiKey }, body: JSON.stringify({ number: job.normalized_phone, mediatype: "document", media: pdfBase64, fileName: `boleto-${firstName}.pdf`, mimetype: "application/pdf" }) },
      );
      if (!resp.ok) throw new Error(`Evolution PDF ${resp.status}: ${await resp.text()}`);
    } else if (block.type === "image") {
      if (!job.boleto_file) continue;
      const fsModule = await import("fs/promises");
      const fsPath = job.boleto_file.replace("/media/", "/media-files/");
      const jpgPath = fsPath.replace(/\.pdf$/i, ".jpg");
      await fsModule.access(fsPath);
      const { convertPdfToJpg } = await import("../lib/pdf-to-image");
      await convertPdfToJpg(fsPath, jpgPath);
      const imageBuffer = await fsModule.readFile(jpgPath);
      const imageBase64 = cleanBase64(imageBuffer.toString("base64"));
      const resp = await fetchWithTimeout(
        `${evoBaseUrl}/message/sendMedia/${encodeURIComponent(job.instance_name)}`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: evoApiKey }, body: JSON.stringify({ number: job.normalized_phone, mediatype: "image", media: imageBase64, caption: "" }) },
      );
      if (!resp.ok) throw new Error(`Evolution Image ${resp.status}: ${await resp.text()}`);
    }

    if (i < blocks.length - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

function isExistsFalseError(message: string): boolean {
  return message.includes('"exists":false') || message.includes('"exists": false');
}

async function processWorkspaceSend(
  sb: ReturnType<typeof getServiceClient>,
  setting: WorkspaceSetting,
  includeFailed: boolean,
): Promise<{ sent: number; failed: number; skipped: number; pending: number }> {
  const today = getTodayBrasilia();
  const result = { sent: 0, failed: 0, skipped: 0, pending: 0 };
  if (!setting.instance_name) return result;

  // Recover stale processing jobs
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await sb.from(FOLLOWUP_QUEUE_TABLE).update({ status: "pending", started_at: null, updated_at: new Date().toISOString(), last_error: "Job reencolado após processamento travado" })
    .eq("workspace_id", setting.workspace_id).eq("dispatch_date", today).eq("status", "processing").lte("updated_at", staleCutoff);

  // Pick jobs
  const statusesToPick = includeFailed ? ["pending", "failed"] : ["pending"];
  const { data: queueRows, error: queueError } = await sb.from(FOLLOWUP_QUEUE_TABLE).select("*")
    .eq("workspace_id", setting.workspace_id).eq("dispatch_date", today).in("status", statusesToPick)
    .order("created_at", { ascending: true }).limit(2000);
  if (queueError) throw queueError;

  const jobs = (queueRows || []) as FollowUpQueueRow[];
  if (jobs.length === 0) return result;

  // Get queue config for delay
  const { data: queueConfig } = await sb.from("message_queue_config").select("delay_seconds, pause_after_sends, pause_minutes")
    .eq("workspace_id", setting.workspace_id).eq("instance_name", setting.instance_name).maybeSingle();
  const qc = queueConfig as any;
  const delayMs = Math.max(qc?.delay_seconds || 30, 5) * 1000;

  const queue = getMessageQueue(setting.instance_name, delayMs, qc?.pause_after_sends ?? null, qc?.pause_minutes ?? null);

  // Track phone send counts for phone limit
  const phoneSendCount = new Map<string, number>();
  // Pre-load today's sent jobs for phone counting
  const { data: sentJobs } = await sb.from(FOLLOWUP_QUEUE_TABLE).select("normalized_phone")
    .eq("workspace_id", setting.workspace_id).eq("dispatch_date", today).eq("status", "sent");
  for (const sj of (sentJobs || []) as any[]) {
    if (sj.normalized_phone) phoneSendCount.set(sj.normalized_phone, (phoneSendCount.get(sj.normalized_phone) || 0) + 1);
  }

  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 20_000;

  for (const job of jobs) {
    const currentStatus = job.status;
    const normalizedPhone = normalizePhone(job.normalized_phone || job.phone) || null;

    // Re-validate phone
    if (!normalizedPhone || normalizedPhone.length < 12) {
      await markQueueJob(sb, job.id, { status: "skipped_invalid_phone", last_error: "Telefone inválido ou incompleto", completed_at: new Date().toISOString() });
      result.skipped++;
      continue;
    }

    // Phone limit check
    const currentCount = phoneSendCount.get(normalizedPhone) || 0;
    const maxPerPhone = setting.max_messages_per_phone_per_day ?? 1;
    if (currentCount >= maxPerPhone) {
      await markQueueJob(sb, job.id, { status: "skipped_phone_limit", last_error: `Limite diário atingido para ${normalizedPhone}`, completed_at: new Date().toISOString() });
      result.skipped++;
      continue;
    }

    // Verify transaction still pending
    const { data: tx } = await sb.from("transactions").select("status").eq("id", job.transaction_id).maybeSingle();
    if (!tx || tx.status !== "pendente") {
      await markQueueJob(sb, job.id, { status: "sent", last_error: `Transação já ${tx?.status || "não encontrada"} — skip`, completed_at: new Date().toISOString() });
      result.skipped++;
      continue;
    }

    // Claim
    const claimTime = new Date().toISOString();
    const { data: claimedRows } = await sb.from(FOLLOWUP_QUEUE_TABLE)
      .update({ status: "processing", started_at: claimTime, updated_at: claimTime, attempts: (job.attempts || 0) + 1 })
      .eq("id", job.id).eq("status", currentStatus).select("id");
    if (!claimedRows || claimedRows.length === 0) continue;

    // Enqueue to anti-ban queue with retry logic
    queue.enqueue(async () => {
      let lastError = "";
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await dispatchJob({ ...job, normalized_phone: normalizedPhone }, delayMs);
          return; // success
        } catch (err: any) {
          lastError = err?.message?.slice(0, 500) || "Falha desconhecida";
          console.warn(`[followup-daily] ⚠️ Attempt ${attempt}/${MAX_RETRIES} failed for ${job.transaction_id}: ${lastError}`);

          // Non-retryable: exists:false
          if (isExistsFalseError(lastError)) {
            throw new Error(`NON_RETRYABLE:${lastError}`);
          }

          if (attempt < MAX_RETRIES) {
            await markQueueJob(sb, job.id, { attempts: attempt, last_error: `Tentativa ${attempt}/${MAX_RETRIES}: ${lastError}` });
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }
      throw new Error(lastError);
    }, `followup:${job.transaction_id}:${job.rule_id}`)
      .then(async () => {
        await markQueueJob(sb, job.id, { status: "sent", last_error: null, completed_at: new Date().toISOString(), normalized_phone: normalizedPhone });
        console.log(`[followup-daily] ✅ Sent follow-up for boleto ${job.transaction_id}`);
      })
      .catch(async (err: any) => {
        const message = err?.message?.slice(0, 500) || "Falha desconhecida";
        if (message.startsWith("NON_RETRYABLE:")) {
          const reason = message.replace("NON_RETRYABLE:", "");
          await markQueueJob(sb, job.id, {
            status: "skipped_invalid_phone",
            last_error: `Número sem WhatsApp (exists:false): ${reason}`,
            completed_at: new Date().toISOString(),
            normalized_phone: normalizedPhone,
          });
          console.warn(`[followup-daily] ⏭️ Skipped boleto ${job.transaction_id} — number doesn't exist on WhatsApp`);
        } else {
          await markQueueJob(sb, job.id, {
            status: "failed",
            last_error: `${MAX_RETRIES} tentativas esgotadas: ${message}`,
            completed_at: new Date().toISOString(),
            normalized_phone: normalizedPhone,
          });
          console.error(`[followup-daily] ❌ Failed follow-up for boleto ${job.transaction_id} after ${MAX_RETRIES} retries: ${message}`);
        }
      });

    phoneSendCount.set(normalizedPhone, currentCount + 1);
    result.sent++;
    console.log(`[followup-daily] 📤 Enqueued follow-up for boleto ${job.transaction_id}`);
  }

  const { count } = await sb.from(FOLLOWUP_QUEUE_TABLE).select("id", { count: "exact", head: true })
    .eq("workspace_id", setting.workspace_id).eq("dispatch_date", today).eq("status", "pending");
  result.pending = count || 0;

  return result;
}

export async function processFollowUpDaily(options: { workspaceIds?: string[]; includeFailed?: boolean; source?: string } = {}) {
  const sb = getServiceClient();
  const source = options.source || "cron";
  const includeFailed = options.includeFailed ?? false;
  const workspaceIds = options.workspaceIds?.filter(Boolean);

  // If manual, also run prepare first to pick up any new matches
  if (source === "manual") {
    await prepareFollowUpDaily(workspaceIds);
  }

  let settingsQuery = sb.from("followup_settings")
    .select("workspace_id, user_id, instance_name, send_at_hour, enabled, max_messages_per_phone_per_day");
  if (workspaceIds && workspaceIds.length > 0) {
    settingsQuery = settingsQuery.in("workspace_id", workspaceIds);
    if (source !== "manual") settingsQuery = settingsQuery.eq("enabled", true);
  } else {
    settingsQuery = settingsQuery.eq("enabled", true);
  }

  const { data: allSettings, error } = await settingsQuery;
  if (error) throw error;
  if (!allSettings || allSettings.length === 0) return { ok: true, source, processed: 0, sent: 0, failed: 0, skipped: 0, pendingAfterRun: 0, generated: 0, requeued: 0, locked: 0 };

  let totalSent = 0, totalFailed = 0, totalSkipped = 0, totalPending = 0;
  for (const setting of allSettings as WorkspaceSetting[]) {
    try {
      console.log(`[followup-daily] Processing send for workspace ${setting.workspace_id} (includeFailed=${includeFailed})`);
      const r = await processWorkspaceSend(sb, setting, includeFailed);
      totalSent += r.sent;
      totalFailed += r.failed;
      totalSkipped += r.skipped;
      totalPending += r.pending;
      if (r.sent > 0 || r.failed > 0) {
        console.log(`[followup-daily] Workspace ${setting.workspace_id}: enqueued=${r.sent}, failed=${r.failed}, skipped=${r.skipped}, pending=${r.pending}`);
      }
    } catch (err: any) {
      totalFailed++;
      console.error(`[followup-daily] Error workspace ${setting.workspace_id}: ${err.message}`);
    }
  }

  return { ok: true, source, processed: allSettings.length, sent: totalSent, failed: totalFailed, skipped: totalSkipped, pendingAfterRun: totalPending, generated: 0, requeued: 0, locked: 0 };
}

// ═══════════════════════════
// ROUTES
// ═══════════════════════════

// POST /prepare — Phase 1
router.post("/prepare", async (req, res) => {
  try {
    const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId : undefined;
    const result = await prepareFollowUpDaily(workspaceId ? [workspaceId] : undefined);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[followup-daily/prepare]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /process — Phase 2
router.post("/process", async (req, res) => {
  try {
    const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId : undefined;
    const includeFailed = req.body?.includeFailed !== false;
    const result = await processFollowUpDaily({
      workspaceIds: workspaceId ? [workspaceId] : undefined,
      includeFailed,
      source: "manual",
    });
    res.json(result);
  } catch (err: any) {
    console.error("[followup-daily/process]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /status — lê direto da followup_dispatch_queue
router.get("/status", async (req, res) => {
  try {
    const workspaceId = String(req.query.workspaceId || "").trim();
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    const today = getTodayBrasilia();

    // Recover stale processing jobs
    const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await sb.from(FOLLOWUP_QUEUE_TABLE).update({ status: "failed", last_error: "Job travado — tempo limite excedido", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId).eq("dispatch_date", today).eq("status", "processing").lte("updated_at", staleCutoff);

    const { data: jobs, error } = await sb.from(FOLLOWUP_QUEUE_TABLE)
      .select("id, transaction_id, rule_id, customer_name, normalized_phone, status, last_error, attempts, created_at, started_at, completed_at")
      .eq("workspace_id", workspaceId).eq("dispatch_date", today).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;

    const counts = { pending: 0, processing: 0, sent: 0, failed: 0, skipped_phone_limit: 0, skipped_invalid_phone: 0, skipped_duplicate: 0 };
    for (const job of jobs || []) {
      const status = (job as any).status;
      if (status in counts) (counts as any)[status] += 1;
    }

    res.json({ ok: true, workspaceId, date: today, counts, jobs: jobs || [] });
  } catch (err: any) {
    console.error("[followup-daily/status]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
