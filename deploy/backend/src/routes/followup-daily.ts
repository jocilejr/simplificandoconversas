import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { getMessageQueue } from "../lib/message-queue";
import { normalizePhone } from "../lib/normalize-phone";


const router = Router();

const FOLLOWUP_QUEUE_TABLE = "followup_dispatch_queue" as any;
const FINAL_JOB_STATUSES = new Set([
  "sent",
  "skipped_phone_limit",
  "skipped_invalid_phone",
  "skipped_duplicate",
]);

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

interface TodayContactRow {
  transaction_id: string;
  rule_id: string | null;
  notes: string | null;
}

interface WorkspaceContext {
  today: string;
  expirationDays: number;
  rules: Rule[];
  boletos: BoletoRow[];
  todayContacts: TodayContactRow[];
  existingJobs: FollowUpQueueRow[];
  contactPhonesByTransactionId: Map<string, string>;
  delayMs: number;
  pauseAfterSends: number | null;
  pauseMinutes: number | null;
}

interface WorkspaceRunResult {
  workspaceId: string;
  generated: number;
  requeued: number;
  sent: number;
  failed: number;
  skipped: number;
  skippedNoRule: number;
  skippedAlreadyContacted: number;
  skippedInvalidPhone: number;
  skippedPhoneLimit: number;
  skippedNoBlocks: number;
  skippedDuplicate: number;
  pendingAfterRun: number;
  locked?: boolean;
  instanceMissing?: boolean;
}

interface ProcessOptions {
  workspaceIds?: string[];
  includeFailed?: boolean;
  source?: "cron" | "manual" | "resume";
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getGreeting(): string {
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brasiliaHour >= 5 && brasiliaHour < 12) return "Bom dia";
  if (brasiliaHour >= 12 && brasiliaHour < 18) return "Boa tarde";
  return "Boa noite";
}

function normalizeDueDateForMessage(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00-03:00`;
  }
  return value;
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
  if (cleaned.startsWith("data:") && cleaned.includes(",")) {
    cleaned = cleaned.split(",")[1];
  }
  return cleaned.replace(/\s/g, "");
}

function getTodayBrasilia(): string {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA.slice(0, 10));
  const b = new Date(dateB.slice(0, 10));
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function findMatchingRule(
  rules: Rule[],
  createdAt: string,
  dueDate: string,
  today: string,
): Rule | null {
  const daysSinceGeneration = daysBetween(createdAt, today);
  const daysUntilDue = daysBetween(today, dueDate);
  const daysAfterDue = daysBetween(dueDate, today);

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

function makeRuleKey(transactionId: string, ruleId: string | null | undefined) {
  return `${transactionId}:${ruleId || "null"}`;
}

function isFailedContact(notes: string | null | undefined) {
  return !!notes && notes.startsWith("failed_api");
}

function isBlockingContact(notes: string | null | undefined) {
  return !isFailedContact(notes);
}

function countsAsSuccessfulContact(notes: string | null | undefined) {
  return !notes || (!notes.startsWith("failed_api") && !notes.startsWith("skipped_phone_limit") && !notes.startsWith("skipped_invalid_phone"));
}

function isBlockingJobStatus(status: string | null | undefined) {
  return !!status && FINAL_JOB_STATUSES.has(status);
}

function buildBlocks(rule: Rule): FollowUpBlock[] {
  const blocks: FollowUpBlock[] = [];
  if (rule.message?.trim()) {
    blocks.push({ type: "text", content: rule.message });
  }
  const mediaBlocks = Array.isArray(rule.media_blocks) ? rule.media_blocks : [];
  for (const block of mediaBlocks) {
    if (block && typeof block === "object" && typeof block.type === "string") {
      blocks.push(block as FollowUpBlock);
    }
  }
  return blocks;
}

function makeEmptyWorkspaceResult(workspaceId: string): WorkspaceRunResult {
  return {
    workspaceId,
    generated: 0,
    requeued: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    skippedNoRule: 0,
    skippedAlreadyContacted: 0,
    skippedInvalidPhone: 0,
    skippedPhoneLimit: 0,
    skippedNoBlocks: 0,
    skippedDuplicate: 0,
    pendingAfterRun: 0,
  };
}

async function loadWorkspaceContext(
  sb: ReturnType<typeof getServiceClient>,
  workspaceId: string,
  instanceName: string,
): Promise<WorkspaceContext> {
  const today = getTodayBrasilia();
  const todayStart = `${today}T00:00:00-03:00`;
  const todayEnd = `${today}T23:59:59-03:00`;

  const [
    rulesResult,
    boletoSettingsResult,
    boletosResult,
    todayContactsResult,
    queueConfigResult,
    existingJobsResult,
  ] = await Promise.all([
    sb
      .from("boleto_recovery_rules")
      .select("id, name, rule_type, days, message, media_blocks, priority")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .neq("rule_type", "immediate")
      .order("priority", { ascending: true }),
    sb
      .from("boleto_settings")
      .select("default_expiration_days")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    sb
      .from("transactions")
      .select("id, created_at, customer_name, customer_phone, customer_document, amount, metadata, external_id")
      .eq("workspace_id", workspaceId)
      .eq("type", "boleto")
      .eq("status", "pendente")
      .order("created_at", { ascending: true }),
    sb
      .from("boleto_recovery_contacts")
      .select("transaction_id, rule_id, notes")
      .eq("workspace_id", workspaceId)
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd),
    sb
      .from("message_queue_config")
      .select("delay_seconds, pause_after_sends, pause_minutes")
      .eq("workspace_id", workspaceId)
      .eq("instance_name", instanceName)
      .maybeSingle(),
    sb
      .from(FOLLOWUP_QUEUE_TABLE)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("dispatch_date", today),
  ]);

  const todayContacts = (todayContactsResult.data || []) as TodayContactRow[];
  const contactTransactionIds = [...new Set(todayContacts.map((item) => item.transaction_id).filter(Boolean))];
  const contactPhonesByTransactionId = new Map<string, string>();

  if (contactTransactionIds.length > 0) {
    const { data: contactTransactions } = await sb
      .from("transactions")
      .select("id, customer_phone")
      .in("id", contactTransactionIds);

    for (const transaction of contactTransactions || []) {
      const phone = normalizePhoneDefensive((transaction as any).customer_phone);
      if (phone) {
        contactPhonesByTransactionId.set((transaction as any).id, phone);
      }
    }
  }

  const queueConfig = queueConfigResult.data as any;
  const delayMs = Math.max(queueConfig?.delay_seconds || 30, 5) * 1000;

  return {
    today,
    expirationDays: (boletoSettingsResult.data as any)?.default_expiration_days || 7,
    rules: (rulesResult.data || []) as Rule[],
    boletos: (boletosResult.data || []) as BoletoRow[],
    todayContacts,
    existingJobs: ((existingJobsResult.data || []) as FollowUpQueueRow[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    contactPhonesByTransactionId,
    delayMs,
    pauseAfterSends: queueConfig?.pause_after_sends ?? null,
    pauseMinutes: queueConfig?.pause_minutes ?? null,
  };
}

async function insertRecoveryContact(
  sb: ReturnType<typeof getServiceClient>,
  input: {
    workspaceId: string;
    userId: string;
    transactionId: string;
    ruleId: string;
    notes: string;
  },
) {
  await sb.from("boleto_recovery_contacts").insert({
    workspace_id: input.workspaceId,
    user_id: input.userId,
    transaction_id: input.transactionId,
    rule_id: input.ruleId,
    notes: input.notes,
  });
}

async function upsertDispatchJob(
  sb: ReturnType<typeof getServiceClient>,
  payload: Partial<FollowUpQueueRow> & Record<string, any>,
) {
  const { error } = await sb
    .from(FOLLOWUP_QUEUE_TABLE)
    .upsert(payload, {
      onConflict: "workspace_id,transaction_id,rule_id,dispatch_date",
    });

  if (error) {
    throw error;
  }
}

async function generateJobsForWorkspace(
  sb: ReturnType<typeof getServiceClient>,
  setting: WorkspaceSetting,
  context: WorkspaceContext,
  includeFailed: boolean,
  result: WorkspaceRunResult,
) {
  const blockedRuleKeys = new Set<string>();
  const failedRuleKeys = new Set<string>();
  const existingJobsByKey = new Map<string, FollowUpQueueRow>();

  for (const contact of context.todayContacts) {
    const key = makeRuleKey(contact.transaction_id, contact.rule_id);
    if (isBlockingContact(contact.notes)) {
      blockedRuleKeys.add(key);
    } else {
      failedRuleKeys.add(key);
    }
  }

  for (const job of context.existingJobs) {
    const key = makeRuleKey(job.transaction_id, job.rule_id);
    existingJobsByKey.set(key, job);
    if (isBlockingJobStatus(job.status)) {
      blockedRuleKeys.add(key);
    }
  }

  // CPF-based deduplication: only the first boleto per CPF gets processed
  const processedCpfs = new Set<string>();

  for (const boleto of context.boletos) {
    const dueDate = new Date(
      new Date(boleto.created_at).getTime() + context.expirationDays * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    const matchingRule = findMatchingRule(context.rules, boleto.created_at, dueDate, context.today);
    if (!matchingRule) {
      result.skippedNoRule++;
      result.skipped++;
      continue;
    }

    const ruleKey = makeRuleKey(boleto.id, matchingRule.id);
    const existingJob = existingJobsByKey.get(ruleKey);

    // 2. Already contacted today? Skip
    if (blockedRuleKeys.has(ruleKey)) {
      result.skippedAlreadyContacted++;
      result.skipped++;
      continue;
    }

    // 3. Job already exists with final status? Skip
    if (existingJob && FINAL_JOB_STATUSES.has(existingJob.status)) {
      result.skipped++;
      continue;
    }

    // 4. Has blocks?
    const blocks = buildBlocks(matchingRule);
    if (blocks.length === 0) {
      result.skippedNoBlocks++;
      result.skipped++;
      continue;
    }

    // 5. NOW: CPF deduplication (only after all validations pass)
    const cpf = boleto.customer_document?.replace(/\D/g, "") || null;
    if (cpf && cpf.length >= 11) {
      if (processedCpfs.has(cpf)) {
        const normalized = boleto.customer_phone || null;
        const meta = (boleto.metadata as any) || {};
        const barcode = meta.barcode || meta.digitable_line || boleto.external_id || "";
        await upsertDispatchJob(sb, {
          workspace_id: setting.workspace_id,
          user_id: setting.user_id,
          transaction_id: boleto.id,
          rule_id: matchingRule.id,
          instance_name: setting.instance_name,
          phone: boleto.customer_phone,
          normalized_phone: normalized,
          customer_name: boleto.customer_name,
          amount: Number(boleto.amount) || 0,
          barcode,
          boleto_file: meta.boleto_file || null,
          due_date: dueDate,
          dispatch_date: context.today,
          message_snapshot: matchingRule.message || null,
          blocks_snapshot: blocks,
          updated_at: new Date().toISOString(),
          status: "skipped_duplicate",
          last_error: `CPF duplicado: ${cpf}`,
          completed_at: new Date().toISOString(),
        });
        result.skippedDuplicate++;
        result.skipped++;
        continue;
      }
      processedCpfs.add(cpf);
    }

    // 6. Use customer_phone directly (already normalized in transactions table)
    const normalized = boleto.customer_phone || null;
    const meta = (boleto.metadata as any) || {};
    const barcode = meta.barcode || meta.digitable_line || boleto.external_id || "";
    const basePayload = {
      workspace_id: setting.workspace_id,
      user_id: setting.user_id,
      transaction_id: boleto.id,
      rule_id: matchingRule.id,
      instance_name: setting.instance_name,
      phone: boleto.customer_phone,
      normalized_phone: normalized,
      customer_name: boleto.customer_name,
      amount: Number(boleto.amount) || 0,
      barcode,
      boleto_file: meta.boleto_file || null,
      due_date: dueDate,
      dispatch_date: context.today,
      message_snapshot: matchingRule.message || null,
      blocks_snapshot: blocks,
      updated_at: new Date().toISOString(),
    };

    if (!normalized || normalized.length < 12) {
      await upsertDispatchJob(sb, {
        ...basePayload,
        status: "skipped_invalid_phone",
        last_error: "Telefone inválido ou incompleto",
        completed_at: new Date().toISOString(),
      });

      if (!blockedRuleKeys.has(ruleKey)) {
        await insertRecoveryContact(sb, {
          workspaceId: setting.workspace_id,
          userId: setting.user_id,
          transactionId: boleto.id,
          ruleId: matchingRule.id,
          notes: "skipped_invalid_phone",
        });
      }

      blockedRuleKeys.add(ruleKey);
      existingJobsByKey.set(ruleKey, { ...(existingJob || {}), ...(basePayload as any), status: "skipped_invalid_phone" } as FollowUpQueueRow);
      result.skippedInvalidPhone++;
      result.skipped++;
      continue;
    }

    if (existingJob) {
      if (existingJob.status === "pending" || existingJob.status === "processing") {
        continue;
      }
      if (existingJob.status === "failed" && includeFailed) {
        await upsertDispatchJob(sb, {
          ...basePayload,
          id: existingJob.id,
          status: "pending",
          last_error: null,
          started_at: null,
          completed_at: null,
        });
        existingJobsByKey.set(ruleKey, {
          ...existingJob,
          ...(basePayload as any),
          status: "pending",
          last_error: null,
          started_at: null,
          completed_at: null,
        });
        failedRuleKeys.delete(ruleKey);
        result.requeued++;
        continue;
      }
      if (existingJob.status === "failed") {
        continue;
      }
    }

    await upsertDispatchJob(sb, {
      ...basePayload,
      status: "pending",
      last_error: null,
      started_at: null,
      completed_at: null,
    });

    existingJobsByKey.set(ruleKey, { ...(basePayload as any), status: "pending" } as FollowUpQueueRow);
    result.generated++;
  }

  return { blockedRuleKeys, failedRuleKeys };
}

function buildPhoneSendCount(context: WorkspaceContext) {
  const counts = new Map<string, number>();
  for (const contact of context.todayContacts) {
    if (!countsAsSuccessfulContact(contact.notes)) continue;
    const normalizedPhone = context.contactPhonesByTransactionId.get(contact.transaction_id);
    if (!normalizedPhone) continue;
    counts.set(normalizedPhone, (counts.get(normalizedPhone) || 0) + 1);
  }
  return counts;
}

async function markQueueJob(
  sb: ReturnType<typeof getServiceClient>,
  jobId: string,
  values: Record<string, any>,
) {
  const { error } = await sb
    .from(FOLLOWUP_QUEUE_TABLE)
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    throw error;
  }
}

async function dispatchJob(
  job: FollowUpQueueRow,
  delayMs: number,
) {
  const evoBaseUrl = process.env.EVOLUTION_API_URL || "http://evolution:8080";
  const evoApiKey = process.env.EVOLUTION_API_KEY || "";
  const blocks = Array.isArray(job.blocks_snapshot) ? job.blocks_snapshot : [];

  const vars = {
    name: job.customer_name,
    amount: Number(job.amount) || 0,
    dueDate: job.due_date,
    barcode: job.barcode,
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === "text") {
      const text = replaceVariables(block.content || "", vars);
      const resp = await fetchWithTimeout(
        `${evoBaseUrl}/message/sendText/${encodeURIComponent(job.instance_name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoApiKey },
          body: JSON.stringify({ number: job.normalized_phone, text }),
        },
      );
      if (!resp.ok) {
        throw new Error(`Evolution sendText ${resp.status}: ${await resp.text()}`);
      }
    } else if (block.type === "pdf") {
      if (!job.boleto_file) continue;
      const fsModule = await import("fs/promises");
      const fsPath = job.boleto_file.replace("/media/", "/media-files/");
      const pdfBuffer = await fsModule.readFile(fsPath);
      const pdfBase64 = cleanBase64(pdfBuffer.toString("base64"));
      const firstName = vars.name ? vars.name.split(" ")[0] : "cliente";
      const resp = await fetchWithTimeout(
        `${evoBaseUrl}/message/sendMedia/${encodeURIComponent(job.instance_name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoApiKey },
          body: JSON.stringify({
            number: job.normalized_phone,
            mediatype: "document",
            media: pdfBase64,
            fileName: `boleto-${firstName}.pdf`,
            mimetype: "application/pdf",
          }),
        },
      );
      if (!resp.ok) {
        throw new Error(`Evolution PDF ${resp.status}: ${await resp.text()}`);
      }
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
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoApiKey },
          body: JSON.stringify({
            number: job.normalized_phone,
            mediatype: "image",
            media: imageBase64,
            caption: "",
          }),
        },
      );
      if (!resp.ok) {
        throw new Error(`Evolution Image ${resp.status}: ${await resp.text()}`);
      }
    }

    if (i < blocks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function processQueueForWorkspace(
  sb: ReturnType<typeof getServiceClient>,
  setting: WorkspaceSetting,
  context: WorkspaceContext,
  includeFailed: boolean,
  result: WorkspaceRunResult,
) {
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await sb
    .from(FOLLOWUP_QUEUE_TABLE)
    .update({
      status: "pending",
      started_at: null,
      updated_at: new Date().toISOString(),
      last_error: "Job reencolado após processamento travado",
    })
    .eq("workspace_id", setting.workspace_id)
    .eq("dispatch_date", context.today)
    .eq("status", "processing")
    .lte("updated_at", staleCutoff);

  const statusesToPick = includeFailed ? ["pending", "failed"] : ["pending"];
  const { data: queueRows, error: queueError } = await sb
    .from(FOLLOWUP_QUEUE_TABLE)
    .select("*")
    .eq("workspace_id", setting.workspace_id)
    .eq("dispatch_date", context.today)
    .in("status", statusesToPick)
    .order("created_at", { ascending: true })
    .limit(2000);

  if (queueError) throw queueError;

  const jobs = (queueRows || []) as FollowUpQueueRow[];
  if (jobs.length === 0) {
    result.pendingAfterRun = 0;
    return;
  }

  const queue = getMessageQueue(
    setting.instance_name!,
    context.delayMs,
    context.pauseAfterSends,
    context.pauseMinutes,
  );

  const phoneSendCount = buildPhoneSendCount(context);
  const blockingContactKeys = new Set<string>();
  const failedContactKeys = new Set<string>();

  for (const contact of context.todayContacts) {
    const key = makeRuleKey(contact.transaction_id, contact.rule_id);
    if (isBlockingContact(contact.notes)) {
      blockingContactKeys.add(key);
    } else {
      failedContactKeys.add(key);
    }
  }

  for (const job of jobs) {
    const currentStatus = job.status;
    const claimTime = new Date().toISOString();
    const ruleKey = makeRuleKey(job.transaction_id, job.rule_id);

    const { data: claimedRows, error: claimError } = await sb
      .from(FOLLOWUP_QUEUE_TABLE)
      .update({
        status: "processing",
        started_at: claimTime,
        updated_at: claimTime,
        attempts: (job.attempts || 0) + 1,
      })
      .eq("id", job.id)
      .eq("status", currentStatus)
      .select("id");

    if (claimError) throw claimError;
    if (!claimedRows || claimedRows.length === 0) continue;

    const normalizedPhone = job.normalized_phone || job.phone || null;
    if (!normalizedPhone || normalizedPhone.length < 12) {
      await markQueueJob(sb, job.id, {
        status: "skipped_invalid_phone",
        last_error: "Telefone inválido ou incompleto",
        completed_at: new Date().toISOString(),
      });
      if (!blockingContactKeys.has(ruleKey)) {
        await insertRecoveryContact(sb, {
          workspaceId: setting.workspace_id,
          userId: setting.user_id,
          transactionId: job.transaction_id,
          ruleId: job.rule_id,
          notes: "skipped_invalid_phone",
        });
        blockingContactKeys.add(ruleKey);
      }
      result.skippedInvalidPhone++;
      result.skipped++;
      continue;
    }

    const currentCount = phoneSendCount.get(normalizedPhone) || 0;
    const maxMessagesPerPhone = setting.max_messages_per_phone_per_day ?? 1;
    if (currentCount >= maxMessagesPerPhone) {
      await markQueueJob(sb, job.id, {
        status: "skipped_phone_limit",
        last_error: `Limite diário atingido para ${normalizedPhone}`,
        completed_at: new Date().toISOString(),
      });
      if (!blockingContactKeys.has(ruleKey)) {
        await insertRecoveryContact(sb, {
          workspaceId: setting.workspace_id,
          userId: setting.user_id,
          transactionId: job.transaction_id,
          ruleId: job.rule_id,
          notes: "skipped_phone_limit",
        });
        blockingContactKeys.add(ruleKey);
      }
      result.skippedPhoneLimit++;
      result.skipped++;
      continue;
    }

    const { data: tx, error: txError } = await sb
      .from("transactions")
      .select("status")
      .eq("id", job.transaction_id)
      .maybeSingle();

    if (txError) throw txError;

    if (!tx || tx.status !== "pendente") {
      await markQueueJob(sb, job.id, {
        status: "failed",
        last_error: `Transação não está mais pendente (${tx?.status || "não encontrada"})`,
        completed_at: new Date().toISOString(),
      });
      if (!failedContactKeys.has(ruleKey)) {
        await insertRecoveryContact(sb, {
          workspaceId: setting.workspace_id,
          userId: setting.user_id,
          transactionId: job.transaction_id,
          ruleId: job.rule_id,
          notes: `failed_api|Transação não está mais pendente`,
        });
        failedContactKeys.add(ruleKey);
      }
      result.failed++;
      continue;
    }

    // Fire-and-forget: enqueue without blocking the HTTP request
    queue.enqueue(async () => {
      await dispatchJob({ ...job, normalized_phone: normalizedPhone }, context.delayMs);
    }, `followup:${job.transaction_id}:${job.rule_id}`)
      .then(async () => {
        await markQueueJob(sb, job.id, {
          status: "sent",
          last_error: null,
          completed_at: new Date().toISOString(),
          normalized_phone: normalizedPhone,
        });
        await insertRecoveryContact(sb, {
          workspaceId: setting.workspace_id,
          userId: setting.user_id,
          transactionId: job.transaction_id,
          ruleId: job.rule_id,
          notes: "sent|followup_dispatch_queue",
        });
        console.log(`[followup-daily] ✅ Sent follow-up for boleto ${job.transaction_id} (workspace ${setting.workspace_id})`);
      })
      .catch(async (err: any) => {
        const message = err?.message?.slice(0, 500) || "Falha desconhecida";
        await markQueueJob(sb, job.id, {
          status: "failed",
          last_error: message,
          completed_at: new Date().toISOString(),
          normalized_phone: normalizedPhone,
        });
        await insertRecoveryContact(sb, {
          workspaceId: setting.workspace_id,
          userId: setting.user_id,
          transactionId: job.transaction_id,
          ruleId: job.rule_id,
          notes: `failed_api|${message}`,
        });
        console.error(`[followup-daily] ❌ Failed follow-up for boleto ${job.transaction_id}: ${message}`);
      });

    // Count immediately as enqueued (the queue will process in background)
    phoneSendCount.set(normalizedPhone, currentCount + 1);
    result.sent++;
    console.log(`[followup-daily] 📤 Enqueued follow-up for boleto ${job.transaction_id} (workspace ${setting.workspace_id})`);
  }

  const { count } = await sb
    .from(FOLLOWUP_QUEUE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", setting.workspace_id)
    .eq("dispatch_date", context.today)
    .eq("status", "pending");

  result.pendingAfterRun = count || 0;
}

async function processWorkspace(
  sb: ReturnType<typeof getServiceClient>,
  setting: WorkspaceSetting,
  includeFailed: boolean,
): Promise<WorkspaceRunResult> {
  const workspaceId = setting.workspace_id;
  const result = makeEmptyWorkspaceResult(workspaceId);

  if (!setting.instance_name) {
    result.instanceMissing = true;
    return result;
  }

  const context = await loadWorkspaceContext(sb, workspaceId, setting.instance_name);
  if (context.rules.length === 0 || context.boletos.length === 0) {
    return result;
  }

  console.log(`[followup-daily] Processing workspace ${workspaceId} for ${context.today} (includeFailed=${includeFailed})`);

  await generateJobsForWorkspace(sb, setting, context, includeFailed, result);
  await processQueueForWorkspace(sb, setting, context, includeFailed, result);

  console.log(
    `[followup-daily] Workspace ${workspaceId} summary: generated=${result.generated}, requeued=${result.requeued}, enqueued=${result.sent}, skipped=${result.skipped}, pending_after_run=${result.pendingAfterRun}`,
  );

  return result;
}

export async function processFollowUpDaily(options: ProcessOptions = {}) {
  const sb = getServiceClient();
  const source = options.source || "cron";
  const includeFailed = options.includeFailed ?? false;
  const workspaceIds = options.workspaceIds?.filter(Boolean);

  let settingsQuery = sb
    .from("followup_settings")
    .select("workspace_id, user_id, instance_name, send_at_hour, enabled, max_messages_per_phone_per_day");

  if (workspaceIds && workspaceIds.length > 0) {
    settingsQuery = settingsQuery.in("workspace_id", workspaceIds);
    if (source !== "manual") {
      settingsQuery = settingsQuery.eq("enabled", true);
    }
  } else {
    settingsQuery = settingsQuery.eq("enabled", true);
  }

  const { data: allSettings, error } = await settingsQuery;
  if (error) throw error;

  if (!allSettings || allSettings.length === 0) {
    return {
      source,
      processed: 0,
      generated: 0,
      requeued: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      pendingAfterRun: 0,
      locked: 0,
    };
  }

  let generated = 0;
  let requeued = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let pendingAfterRun = 0;
  let locked = 0;

  for (const setting of allSettings as WorkspaceSetting[]) {
    try {
      const workspaceResult = await processWorkspace(sb, setting, includeFailed);
      generated += workspaceResult.generated;
      requeued += workspaceResult.requeued;
      sent += workspaceResult.sent;
      failed += workspaceResult.failed;
      skipped += workspaceResult.skipped;
      pendingAfterRun += workspaceResult.pendingAfterRun;
      if (workspaceResult.locked) locked += 1;
      if (workspaceResult.instanceMissing) {
        console.log(`[followup-daily] Workspace ${workspaceResult.workspaceId} has no instance configured, skipping`);
      }
    } catch (err: any) {
      failed += 1;
      console.error(`[followup-daily] Error processing workspace ${setting.workspace_id}: ${err.message}`);
    }
  }

  return {
    source,
    processed: allSettings.length,
    generated,
    requeued,
    sent,
    failed,
    skipped,
    pendingAfterRun,
    locked,
  };
}

router.get("/status", async (req, res) => {
  try {
    const workspaceId = String(req.query.workspaceId || "").trim();
    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId required" });
    }

    const sb = getServiceClient();
    const today = getTodayBrasilia();
    const { data: jobs, error } = await sb
      .from(FOLLOWUP_QUEUE_TABLE)
      .select("id, transaction_id, rule_id, customer_name, normalized_phone, status, last_error, attempts, created_at, started_at, completed_at")
      .eq("workspace_id", workspaceId)
      .eq("dispatch_date", today)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const counts = {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      skipped_phone_limit: 0,
      skipped_invalid_phone: 0,
      skipped_duplicate: 0,
    };

    for (const job of jobs || []) {
      const status = (job as any).status;
      if (status in counts) {
        (counts as any)[status] += 1;
      }
    }

    res.json({
      ok: true,
      workspaceId,
      date: today,
      counts,
      jobs: jobs || [],
    });
  } catch (err: any) {
    console.error("[followup-daily/status]", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/process", async (req, res) => {
  try {
    const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId : undefined;
    const includeFailed = req.body?.includeFailed !== false;
    const result = await processFollowUpDaily({
      workspaceIds: workspaceId ? [workspaceId] : undefined,
      includeFailed,
      source: "manual",
    });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[followup-daily/process]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
