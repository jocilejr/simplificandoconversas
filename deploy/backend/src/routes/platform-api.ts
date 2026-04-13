import { Router, Request, Response, NextFunction } from "express";
import { getServiceClient } from "../lib/supabase";
import { resolveWorkspaceId } from "../lib/workspace";
import { dispatchRecovery, checkWhatsAppNumber } from "../lib/recovery-dispatch";
import { getRandomCep } from "../lib/random-ceps";
import { lookupCep } from "../lib/cep-lookup";
import fs from "fs/promises";
import path from "path";

const router = Router();

// ── API Request Logger ──
async function logApiRequest(
  userId: string,
  wsId: string,
  req: Request,
  statusCode: number,
  responseSummary?: string
) {
  try {
    const sb = getServiceClient();
    await sb.from("api_request_logs").insert({
      user_id: userId,
      workspace_id: wsId,
      method: req.method,
      path: req.originalUrl || req.path,
      status_code: statusCode,
      request_body: req.body && Object.keys(req.body).length ? req.body : null,
      response_summary: responseSummary?.substring(0, 500) || null,
      ip_address: req.ip || req.socket?.remoteAddress || null,
    });
  } catch (err: any) {
    const msg = err?.message || JSON.stringify(err);
    console.error(`[logApiRequest] Failed to log ${req.method} ${req.originalUrl || req.path} (${statusCode}):`, msg);
  }
}

// ── Simple in-memory rate limiting ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
  }
  return next();
}

// Clean up rate limit map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

// ── API Key auth middleware ──
async function resolveUserByApiKey(req: Request, res: Response): Promise<{ userId: string; workspaceId: string } | null> {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey || apiKey.length < 32) {
    res.status(401).json({ error: "Missing or invalid X-API-Key header" });
    return null;
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("platform_connections")
    .select("user_id, enabled, workspace_id")
    .eq("platform", "custom_api")
    .eq("credentials->>api_key", apiKey)
    .maybeSingle();

  if (error || !data) {
    res.status(401).json({ error: "Invalid API key" });
    return null;
  }

  if (!data.enabled) {
    res.status(403).json({ error: "API key is disabled" });
    return null;
  }

  const workspaceId = data.workspace_id || (await resolveWorkspaceId(data.user_id));
  if (!workspaceId) {
    res.status(500).json({ error: "No workspace" });
    return null;
  }

  return { userId: data.user_id, workspaceId };
}

// Apply rate limiting to all routes
router.use(rateLimit);

// ── Ping / Health check (no auth required) ──
router.get("/ping", (_req, res) => {
  res.json({ ok: true, service: "platform-api", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════
// INSTANCES / INSTÂNCIAS
// ═══════════════════════════════════════════════════

// GET /api/platform/instances
router.get("/instances", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("whatsapp_instances")
      .select("instance_name, status, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const instances = (data || []).map((i: any) => ({
      instance_name: i.instance_name,
      status: i.status,
      is_active: i.is_active,
      connected: i.status === "open",
    }));

    const response = { data: instances, count: instances.length };
    logApiRequest(userId, workspaceId, req, 200, `${instances.length} instances`);
    res.json(response);
  } catch (err: any) {
    console.error("GET /instances error:", err);
    logApiRequest(userId, workspaceId, req, 500, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// CONTACTS / CLIENTES
// ═══════════════════════════════════════════════════

// GET /api/platform/contacts
router.get("/contacts", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const sb = getServiceClient();
  const { phone, name, instance } = req.query;

  let query = sb
    .from("conversations")
    .select("id, remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at, lid, created_at")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false });

  if (phone) {
    const cleaned = (phone as string).replace(/\D/g, "");
    query = query.or(`phone_number.eq.${cleaned},remote_jid.eq.${cleaned}@s.whatsapp.net`);
  }
  if (name) {
    query = query.ilike("contact_name", `%${name}%`);
  }
  if (instance) {
    query = query.eq("instance_name", instance as string);
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }

  logApiRequest(userId, workspaceId, req, 200, `${data?.length || 0} contacts`);
  res.json({ data: data || [], count: data?.length || 0, offset, limit });
});

// GET /api/platform/contacts/:phone
router.get("/contacts/:phone", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const phone = req.params.phone.replace(/\D/g, "");
  if (!phone) return res.status(400).json({ error: "Invalid phone" });

  const sb = getServiceClient();
  const remoteJid = `${phone}@s.whatsapp.net`;

  const [convRes, tagsRes, remindersRes] = await Promise.all([
    sb.from("conversations")
      .select("id, remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at, lid, created_at")
      .eq("user_id", userId)
      .or(`remote_jid.eq.${remoteJid},phone_number.eq.${phone}`)
      .order("last_message_at", { ascending: false }),
    sb.from("contact_tags")
      .select("tag_name, created_at")
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid),
    sb.from("reminders")
      .select("id, title, description, due_date, completed, created_at")
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid)
      .order("due_date", { ascending: false })
      .limit(20),
  ]);

  if (!convRes.data || convRes.data.length === 0) {
    logApiRequest(userId, workspaceId, req, 404, "Contact not found");
    return res.status(404).json({ error: "Contact not found" });
  }

  logApiRequest(userId, workspaceId, req, 200, `Contact found: ${convRes.data[0]?.contact_name || phone}`);
  res.json({
    contact: convRes.data[0],
    all_instances: convRes.data,
    tags: (tagsRes.data || []).map((t: any) => t.tag_name),
    reminders: remindersRes.data || [],
  });
});

// POST /api/platform/contacts (upsert by phone)
router.post("/contacts", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { phone, name, instance_name } = req.body;
  if (!phone) return res.status(400).json({ error: "phone is required" });

  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 8) return res.status(400).json({ error: "Invalid phone number" });

  const remoteJid = `${cleaned}@s.whatsapp.net`;
  const sb = getServiceClient();

  const { data: existing } = await sb
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .maybeSingle();

  if (existing) {
    const updates: any = {};
    if (name) updates.contact_name = name;
    if (instance_name) updates.instance_name = instance_name;
    updates.phone_number = cleaned;

    const { data, error } = await sb
      .from("conversations")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      logApiRequest(userId, workspaceId, req, 500, error.message);
      return res.status(500).json({ error: error.message });
    }
    logApiRequest(userId, workspaceId, req, 200, `Contact updated: ${cleaned}`);
    return res.json({ data, created: false });
  }

  const { data, error } = await sb
    .from("conversations")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      remote_jid: remoteJid,
      phone_number: cleaned,
      contact_name: name || null,
      instance_name: instance_name || null,
    })
    .select()
    .single();

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  logApiRequest(userId, workspaceId, req, 201, `Contact created: ${cleaned}`);
  res.status(201).json({ data, created: true });
});

// ═══════════════════════════════════════════════════
// TRANSACTIONS / PAGAMENTOS
// ═══════════════════════════════════════════════════

// GET /api/platform/transactions
router.get("/transactions", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const sb = getServiceClient();
  const { status, from, to, phone } = req.query;

  let query = sb
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as string);
  if (from) query = query.gte("created_at", from as string);
  if (to) query = query.lte("created_at", to as string);
  if (phone) query = query.eq("customer_phone", (phone as string).replace(/\D/g, ""));

  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }

  logApiRequest(userId, workspaceId, req, 200, `${data?.length || 0} transactions`);
  res.json({ data: data || [], count: data?.length || 0, offset, limit });
});

// POST /api/platform/transactions
router.post("/transactions", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { amount, type, status, description, customer_name, customer_email, customer_phone, customer_document, external_id, source, metadata } = req.body;
  if (amount === undefined || amount === null) return res.status(400).json({ error: "amount is required" });

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("transactions")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      amount: Number(amount),
      type: type || "pix",
      status: status || "pendente",
      description: description || null,
      customer_name: customer_name || null,
      customer_email: customer_email || null,
      customer_phone: customer_phone ? customer_phone.replace(/\D/g, "") : null,
      customer_document: customer_document || null,
      external_id: external_id || null,
      source: source || "api",
      metadata: metadata || null,
    })
    .select()
    .single();

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  logApiRequest(userId, workspaceId, req, 201, `Transaction created: ${data.id}`);
  res.status(201).json({ data });
});

// PATCH /api/platform/transactions/:id
router.patch("/transactions/:id", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { id } = req.params;
  const { status, paid_at, metadata, description } = req.body;

  const updates: any = {};
  if (status !== undefined) updates.status = status;
  if (paid_at !== undefined) updates.paid_at = paid_at;
  if (metadata !== undefined) updates.metadata = metadata;
  if (description !== undefined) updates.description = description;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("transactions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    logApiRequest(userId, workspaceId, req, 404, "Transaction not found");
    return res.status(404).json({ error: "Transaction not found" });
  }

  logApiRequest(userId, workspaceId, req, 200, `Transaction updated: ${data.id}`);
  res.json({ data });
});

// POST /api/platform/transactions/webhook (receive external status updates)
router.post("/transactions/webhook", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { external_id, status, paid_at, metadata } = req.body;
  if (!external_id || !status) {
    return res.status(400).json({ error: "external_id and status are required" });
  }

  const sb = getServiceClient();
  const updates: any = { status };
  if (paid_at) updates.paid_at = paid_at;
  if (metadata) updates.metadata = metadata;

  const { data, error } = await sb
    .from("transactions")
    .update(updates)
    .eq("external_id", external_id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    logApiRequest(userId, workspaceId, req, 404, "Transaction not found for this external_id");
    return res.status(404).json({ error: "Transaction not found for this external_id" });
  }

  logApiRequest(userId, workspaceId, req, 200, `Transaction webhook updated: ${data.id}`);
  res.json({ data });
});

// ═══════════════════════════════════════════════════
// TAGS / SEGMENTAÇÃO
// ═══════════════════════════════════════════════════

// GET /api/platform/tags?phone=X
router.get("/tags", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  if (!phone) return res.status(400).json({ error: "phone query param is required" });

  const remoteJid = `${phone}@s.whatsapp.net`;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from("contact_tags")
    .select("id, tag_name, created_at")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid);

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  logApiRequest(userId, workspaceId, req, 200, `${data?.length || 0} tags`);
  res.json({ data: data || [] });
});

// POST /api/platform/tags
router.post("/tags", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { phone, tag_name } = req.body;
  if (!phone || !tag_name) return res.status(400).json({ error: "phone and tag_name are required" });

  const cleaned = phone.replace(/\D/g, "");
  const remoteJid = `${cleaned}@s.whatsapp.net`;
  const sb = getServiceClient();

  // Check if tag already exists
  const { data: existing } = await sb
    .from("contact_tags")
    .select("id")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .eq("tag_name", tag_name)
    .maybeSingle();

  if (existing) return res.json({ data: existing, created: false });

  const { data, error } = await sb
    .from("contact_tags")
    .insert({ user_id: userId, workspace_id: workspaceId, remote_jid: remoteJid, tag_name: tag_name.trim() })
    .select()
    .single();

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  logApiRequest(userId, workspaceId, req, 201, `Tag created: ${req.body.tag_name}`);
  res.status(201).json({ data, created: true });
});

// DELETE /api/platform/tags
router.delete("/tags", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { phone, tag_name } = req.body;
  if (!phone || !tag_name) return res.status(400).json({ error: "phone and tag_name are required" });

  const cleaned = phone.replace(/\D/g, "");
  const remoteJid = `${cleaned}@s.whatsapp.net`;
  const sb = getServiceClient();

  const { error } = await sb
    .from("contact_tags")
    .delete()
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .eq("tag_name", tag_name);

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  logApiRequest(userId, workspaceId, req, 200, `Tag deleted: ${req.body.tag_name}`);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// REMINDERS / LEMBRETES
// ═══════════════════════════════════════════════════

// GET /api/platform/reminders
router.get("/reminders", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const sb = getServiceClient();
  const { filter, phone } = req.query;

  let query = sb
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  if (phone) {
    const cleaned = (phone as string).replace(/\D/g, "");
    query = query.eq("remote_jid", `${cleaned}@s.whatsapp.net`);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  if (filter === "pending") query = query.eq("completed", false);
  else if (filter === "overdue") query = query.eq("completed", false).lt("due_date", todayStart);
  else if (filter === "today") query = query.gte("due_date", todayStart).lt("due_date", todayEnd);
  else if (filter === "completed") query = query.eq("completed", true);

  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }

  logApiRequest(userId, workspaceId, req, 200, `${data?.length || 0} reminders`);
  res.json({ data: data || [], count: data?.length || 0, offset, limit });
});

// POST /api/platform/reminders
router.post("/reminders", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { phone, title, description, due_date, contact_name, instance_name } = req.body;
  if (!phone || !title || !due_date) {
    return res.status(400).json({ error: "phone, title, and due_date are required" });
  }

  const cleaned = phone.replace(/\D/g, "");
  const remoteJid = `${cleaned}@s.whatsapp.net`;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from("reminders")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      remote_jid: remoteJid,
      phone_number: cleaned,
      title: title.substring(0, 200),
      description: description ? description.substring(0, 1000) : null,
      due_date,
      contact_name: contact_name || null,
      instance_name: instance_name || null,
    })
    .select()
    .single();

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  logApiRequest(userId, workspaceId, req, 201, `Reminder created: ${req.body.title}`);
  res.status(201).json({ data });
});

// PATCH /api/platform/reminders/:id
router.patch("/reminders/:id", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { id } = req.params;
  const { completed, title, description, due_date } = req.body;

  const updates: any = {};
  if (completed !== undefined) updates.completed = completed;
  if (title !== undefined) updates.title = title.substring(0, 200);
  if (description !== undefined) updates.description = description ? description.substring(0, 1000) : null;
  if (due_date !== undefined) updates.due_date = due_date;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reminders")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    logApiRequest(userId, workspaceId, req, 404, "Reminder not found");
    return res.status(404).json({ error: "Reminder not found" });
  }

  logApiRequest(userId, workspaceId, req, 200, `Reminder updated: ${id}`);
  res.json({ data });
});

// DELETE /api/platform/reminders/:id
router.delete("/reminders/:id", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { id } = req.params;
  const sb = getServiceClient();

  // Fetch before deleting so we can send full data in webhook
  const { data: existing } = await sb
    .from("reminders")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) return res.status(404).json({ error: "Reminder not found" });

  const { error } = await sb
    .from("reminders")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    logApiRequest(userId, workspaceId, req, 500, error.message);
    return res.status(500).json({ error: error.message });
  }

  logApiRequest(userId, workspaceId, req, 200, `Reminder deleted: ${id}`);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// MESSAGING / ENVIO DE MENSAGENS
// ═══════════════════════════════════════════════════

const EVOLUTION_URL = process.env.EVOLUTION_URL || "http://evolution:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

async function evolutionRequest(path: string, method: string = "POST", body?: any) {
  const resp = await fetch(`${EVOLUTION_URL}${path}`, {
    method,
    headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return resp.json() as Promise<any>;
}

// POST /api/platform/send-message
router.post("/send-message", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { phone, message, instance, type, reference_id, customer_name, amount } = req.body;
  if (!phone || !message || !instance) {
    return res.status(400).json({ error: "phone, message and instance are required" });
  }

  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 8) return res.status(400).json({ error: "Invalid phone number" });

  const remoteJid = `${cleaned}@s.whatsapp.net`;
  const sb = getServiceClient();
  const instanceName = instance;

  try {
    // Send via Evolution API
    const result = await evolutionRequest(
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      "POST",
      {
        number: cleaned,
        text: message,
      }
    );

    // Ensure conversation exists
    const { data: conv } = await sb
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    let conversationId = conv?.id;

    if (!conversationId) {
      const { data: newConv } = await sb
        .from("conversations")
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          remote_jid: remoteJid,
          phone_number: cleaned,
          contact_name: customer_name || null,
          last_message: message.substring(0, 200),
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      conversationId = newConv?.id;
    } else {
      await sb
        .from("conversations")
        .update({
          last_message: message.substring(0, 200),
          last_message_at: new Date().toISOString(),
          ...(customer_name ? { contact_name: customer_name } : {}),
        })
        .eq("id", conversationId);
    }

    // Save message record
    if (conversationId) {
      await sb.from("messages").insert({
        user_id: userId,
        workspace_id: workspaceId,
        conversation_id: conversationId,
        remote_jid: remoteJid,
        content: message,
        direction: "outbound",
        message_type: "text",
        status: "sent",
        external_id: result?.key?.id || null,
      });
    }

    // If amount provided, create/update transaction
    if (amount !== undefined && amount !== null && reference_id) {
      const { data: existingTx } = await sb
        .from("transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("external_id", reference_id)
        .maybeSingle();

      if (!existingTx) {
        await sb.from("transactions").insert({
          user_id: userId,
          workspace_id: workspaceId,
          external_id: reference_id,
          amount: Number(amount),
          customer_phone: cleaned,
          customer_name: customer_name || null,
          source: "api",
          type: type || "pix",
          status: "pendente",
          description: `Cobrança enviada via API`,
        });
      }
    }


    console.log(`[platform-api] send-message to ${cleaned} via ${instanceName}`);
    logApiRequest(userId, workspaceId, req, 200, `Message sent to ${cleaned} via ${instanceName}, id: ${result?.key?.id || "?"}`);
    res.json({
      ok: true,
      message_id: result?.key?.id || null,
      instance: instanceName,
    });
  } catch (err: any) {
    console.error("[platform-api] send-message error:", err.message);
    logApiRequest(userId, workspaceId, req, 500, err.message);
    res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

// POST /api/platform/send-media
router.post("/send-media", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { phone, media_url, caption, type, instance } = req.body;
  if (!phone || !media_url) {
    return res.status(400).json({ error: "phone and media_url are required" });
  }

  const validTypes = ["image", "video", "audio", "document"];
  const mediaType = type || "image";
  if (!validTypes.includes(mediaType)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
  }

  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 8) return res.status(400).json({ error: "Invalid phone number" });

  const remoteJid = `${cleaned}@s.whatsapp.net`;
  const sb = getServiceClient();

  if (!instance) {
    return res.status(400).json({ error: "phone, media_url and instance are required" });
  }
  const instanceName = instance;

  try {
    let endpoint: string;
    let body: any;

    if (mediaType === "image") {
      endpoint = `/message/sendMedia/${encodeURIComponent(instanceName)}`;
      body = { number: cleaned, mediatype: "image", media: media_url, caption: caption || "" };
    } else if (mediaType === "video") {
      endpoint = `/message/sendMedia/${encodeURIComponent(instanceName)}`;
      body = { number: cleaned, mediatype: "video", media: media_url, caption: caption || "" };
    } else if (mediaType === "audio") {
      endpoint = `/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`;
      body = { number: cleaned, audio: media_url };
    } else {
      // document (PDF, etc.)
      endpoint = `/message/sendMedia/${encodeURIComponent(instanceName)}`;
      const fileName = media_url.split("/").pop() || "document.pdf";
      body = { number: cleaned, mediatype: "document", media: media_url, caption: caption || "", fileName };
    }

    const result = await evolutionRequest(endpoint, "POST", body);

    // Ensure conversation & save message
    const { data: conv } = await sb
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    let conversationId = conv?.id;
    const msgPreview = caption ? caption.substring(0, 200) : `📎 ${mediaType}`;

    if (!conversationId) {
      const { data: newConv } = await sb
        .from("conversations")
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          remote_jid: remoteJid,
          phone_number: cleaned,
          last_message: msgPreview,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      conversationId = newConv?.id;
    } else {
      await sb.from("conversations").update({
        last_message: msgPreview,
        last_message_at: new Date().toISOString(),
      }).eq("id", conversationId);
    }

    if (conversationId) {
      await sb.from("messages").insert({
        user_id: userId,
        workspace_id: workspaceId,
        conversation_id: conversationId,
        remote_jid: remoteJid,
        content: caption || null,
        direction: "outbound",
        message_type: mediaType,
        media_url: media_url,
        status: "sent",
        external_id: result?.key?.id || null,
      });
    }

    console.log(`[platform-api] send-media (${mediaType}) to ${cleaned} via ${instanceName}`);
    logApiRequest(userId, workspaceId, req, 200, `Media (${mediaType}) sent to ${cleaned} via ${instanceName}`);
    res.json({ ok: true, message_id: result?.key?.id || null, instance: instanceName });
  } catch (err: any) {
    console.error("[platform-api] send-media error:", err.message);
    logApiRequest(userId, workspaceId, req, 500, err.message);
    res.status(500).json({ error: err.message || "Failed to send media" });
  }
});

// POST /api/platform/validate-number
router.post("/validate-number", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  const { phone, instance } = req.body;
  if (!phone || !instance) return res.status(400).json({ error: "phone and instance are required" });

  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 8) return res.status(400).json({ error: "Invalid phone number" });

  const sb = getServiceClient();
  const instanceName = instance;

  try {
    const result = await evolutionRequest(
      `/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`,
      "POST",
      { numbers: [cleaned] }
    );

    const numberInfo = Array.isArray(result) ? result[0] : result;
    const exists = numberInfo?.exists || false;

    // Also check if we have this contact
    const remoteJid = `${cleaned}@s.whatsapp.net`;
    const { data: conv } = await sb
      .from("conversations")
      .select("id, contact_name")
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    logApiRequest(userId, workspaceId, req, 200, `Number ${cleaned}: exists=${exists}`);
    res.json({
      exists,
      is_mobile: exists,
      jid: numberInfo?.jid || remoteJid,
      known_contact: conv ? { name: conv.contact_name } : null,
    });
  } catch (err: any) {
    console.error("[platform-api] validate-number error:", err.message);
    logApiRequest(userId, workspaceId, req, 500, err.message);
    res.status(500).json({ error: err.message || "Failed to validate number" });
  }
});

// ═══════════════════════════════════════════════════
// GENERATE PAYMENT (Mercado Pago)
// ═══════════════════════════════════════════════════

const MP_API = "https://api.mercadopago.com";

const STATUS_MAP: Record<string, string> = {
  pending: "pendente",
  approved: "aprovado",
  authorized: "autorizado",
  in_process: "processando",
  in_mediation: "em_mediacao",
  rejected: "rejeitado",
  cancelled: "cancelado",
  refunded: "reembolsado",
  charged_back: "estornado",
};

async function downloadAndSaveBoletoPdf(
  paymentUrl: string,
  userId: string,
  mpId: string | number
): Promise<string | null> {
  if (!paymentUrl) return null;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const pdfResp = await fetch(paymentUrl, {
        headers: {
          Accept: "application/pdf,*/*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        redirect: "follow",
      });
      if (!pdfResp.ok) {
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 2000 * attempt)); continue; }
        return null;
      }
      const buffer = Buffer.from(await pdfResp.arrayBuffer());
      if (buffer.length < 5 || !buffer.subarray(0, 5).toString("ascii").startsWith("%PDF")) {
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 2000 * attempt)); continue; }
        return null;
      }
      const dir = `/media-files/${userId}/boletos`;
      await fs.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${mpId}.pdf`);
      await fs.writeFile(filePath, buffer);
      return `/media/${userId}/boletos/${mpId}.pdf`;
    } catch (err: any) {
      if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 2000 * attempt)); continue; }
    }
  }
  return null;
}

// POST /api/platform/generate-payment
router.post("/generate-payment", async (req, res) => {
  const _auth = await resolveUserByApiKey(req, res);
  if (!_auth) return;
  const { userId, workspaceId } = _auth;

  try {
    const { customer_name, customer_phone, customer_email, customer_document, amount, description, type } = req.body;
    const paymentType = type || "pix";

    if (!customer_name) {
      logApiRequest(userId, workspaceId, req, 400, "customer_name required");
      return res.status(400).json({ error: "customer_name is required" });
    }
    if (!amount || Number(amount) <= 0) {
      logApiRequest(userId, workspaceId, req, 400, "invalid amount");
      return res.status(400).json({ error: "amount must be > 0" });
    }

    const sb = getServiceClient();

    // Get MP token
    const { data: mpConn } = await sb
      .from("platform_connections")
      .select("credentials")
      .eq("user_id", userId)
      .eq("platform", "mercadopago")
      .eq("enabled", true)
      .single();

    const token = (mpConn?.credentials as any)?.access_token || process.env.MERCADOPAGO_ACCESS_TOKEN || "";
    if (!token) {
      logApiRequest(userId, workspaceId, req, 500, "No MP token");
      return res.status(500).json({ error: "Mercado Pago access token not configured" });
    }

    // Resolve email
    const FALLBACK_EMAIL = "businessvivaorigem@gmail.com";
    let resolvedEmail = customer_email;
    if (!resolvedEmail && customer_phone) {
      const phone = customer_phone.replace(/\D/g, "");
      const { data: conv } = await sb
        .from("conversations")
        .select("email")
        .eq("user_id", userId)
        .eq("phone_number", phone)
        .not("email", "is", null)
        .limit(1)
        .maybeSingle();
      resolvedEmail = conv?.email || FALLBACK_EMAIL;
    }
    if (!resolvedEmail) resolvedEmail = FALLBACK_EMAIL;

    // Build MP body
    const paymentBody: any = {
      transaction_amount: Number(amount),
      description: description || `Cobrança - ${customer_name}`,
      payment_method_id: paymentType === "boleto" ? "bolbradesco" : "pix",
      payer: {
        email: resolvedEmail,
        first_name: customer_name.split(" ")[0],
        last_name: customer_name.split(" ").slice(1).join(" ") || ".",
        identification: customer_document
          ? { type: "CPF", number: customer_document.replace(/\D/g, "") }
          : undefined,
      },
    };

    if (paymentType === "boleto") {
      try {
        const cep = getRandomCep();
        const addr = await lookupCep(cep);
        paymentBody.payer.address = addr;
      } catch {
        paymentBody.payer.address = {
          zip_code: "01001000", street_name: "Praça da Sé", street_number: "s/n",
          neighborhood: "Sé", city: "São Paulo", federal_unit: "SP",
        };
      }

      // Set 7-day expiration for boleto
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 7);
      paymentBody.date_of_expiration = expDate.toISOString();
    }

    const mpResp = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${userId}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData: any = await mpResp.json();

    if (!mpResp.ok) {
      console.error("[platform/generate-payment] MP error:", JSON.stringify(mpData));
      const errorCause = mpData?.cause?.[0];
      const errorReason = errorCause
        ? `${errorCause.code || ""} - ${errorCause.description || mpData.message || "Unknown"}`.trim()
        : mpData?.message || "Unknown error";

      // Dedup: skip insert if identical rejected transaction exists in last 5 min
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: existingRejected } = await sb
        .from("transactions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("customer_phone", customer_phone || "")
        .eq("amount", Number(amount))
        .eq("type", paymentType)
        .eq("status", "rejeitado")
        .gte("created_at", fiveMinAgo)
        .limit(1)
        .maybeSingle();

      if (!existingRejected) {
        await sb.from("transactions").insert({
          user_id: userId, workspace_id: workspaceId,
          amount: Number(amount), type: paymentType,
          status: "rejeitado", source: "mercadopago",
          customer_name, customer_phone: customer_phone || null,
          customer_email: resolvedEmail, customer_document: customer_document || null,
          description: description || null,
          metadata: { error_reason: errorReason, mp_error: mpData },
        });
      } else {
        console.log("[platform/generate-payment] Skipped duplicate rejected transaction");
      }

      logApiRequest(userId, workspaceId, req, mpResp.status, errorReason);
      return res.status(mpResp.status).json({ error: "Mercado Pago error", details: mpData });
    }

    // Extract payment info
    const paymentUrl = mpData.point_of_interaction?.transaction_data?.ticket_url
      || mpData.transaction_details?.external_resource_url || "";
    const pdfDownloadUrl = mpData.transaction_details?.external_resource_url
      || mpData.point_of_interaction?.transaction_data?.ticket_url || "";
    const barcode = mpData.barcode?.content || mpData.transaction_details?.digitable_line || "";
    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || "";
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || "";

    // Download boleto PDF
    let boletoFilePath: string | null = null;
    if (paymentType === "boleto" && pdfDownloadUrl) {
      boletoFilePath = await downloadAndSaveBoletoPdf(pdfDownloadUrl, userId, mpData.id);
    }

    // Save transaction
    const { data: tx, error: txError } = await sb
      .from("transactions")
      .insert({
        user_id: userId, workspace_id: workspaceId,
        amount: Number(amount), type: paymentType,
        status: STATUS_MAP[mpData.status] || "pendente",
        source: "mercadopago", external_id: String(mpData.id),
        customer_name, customer_phone: customer_phone || null,
        customer_email: resolvedEmail, customer_document: customer_document || null,
        description: description || null, payment_url: paymentUrl,
        metadata: {
          mp_status: mpData.status, barcode, qr_code: qrCode,
          payment_method: mpData.payment_method_id,
          pdf_download_url: pdfDownloadUrl || null,
          ...(boletoFilePath ? { boleto_file: boletoFilePath } : {}),
        },
        paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (txError) {
      logApiRequest(userId, workspaceId, req, 500, txError.message);
      return res.status(500).json({ error: "Payment created but failed to save", mp_id: mpData.id });
    }

    // Upsert conversation
    if (customer_phone) {
      const phone = customer_phone.replace(/\D/g, "");
      await sb.from("conversations").upsert(
        { user_id: userId, workspace_id: workspaceId, remote_jid: `${phone}@s.whatsapp.net`,
          contact_name: customer_name, phone_number: phone, email: resolvedEmail, instance_name: null },
        { onConflict: "user_id,remote_jid,instance_name" }
      );
    }

    const result = {
      success: true,
      transaction_id: tx?.id,
      payment_url: paymentUrl,
      barcode,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      mp_id: mpData.id,
      status: STATUS_MAP[mpData.status] || "pendente",
    };

    logApiRequest(userId, workspaceId, req, 200, `Payment created: ${tx?.id}`);

    // Check WhatsApp number validity and save to DB
    if (tx?.id && customer_phone) {
      try {
        const normalizedPhone = (await import("../lib/normalize-phone")).normalizePhone(customer_phone);
        if (normalizedPhone && normalizedPhone.length >= 12) {
          const { data: recSettings } = await sb
            .from("recovery_settings")
            .select("instance_boleto, instance_pix, instance_name")
            .eq("workspace_id", workspaceId)
            .maybeSingle();

          const instanceName = paymentType === "boleto"
            ? (recSettings as any)?.instance_boleto || (recSettings as any)?.instance_name
            : (recSettings as any)?.instance_pix || (recSettings as any)?.instance_name;

          if (instanceName) {
            const isValid = await checkWhatsAppNumber(normalizedPhone, instanceName);
            if (isValid !== null) {
              await sb.from("transactions").update({ whatsapp_valid: isValid } as any).eq("id", tx.id);
              console.log(`[platform/generate-payment] WhatsApp check for ${normalizedPhone}: ${isValid}`);
            }
          }
        }
      } catch (waErr: any) {
        console.warn("[platform/generate-payment] WhatsApp check error:", waErr.message);
      }
    }

    // Auto-recovery: enqueue if pending and has phone
    if (tx?.id && customer_phone && (result.status === "pendente")) {
      try {
        await dispatchRecovery({
          workspaceId,
          userId,
          transactionId: tx.id,
          customerPhone: customer_phone,
          customerName: customer_name || null,
          amount: Number(amount),
          transactionType: paymentType === "boleto" ? "boleto" : "pix",
        });
        console.log(`[platform/generate-payment] Recovery dispatched for tx ${tx.id} (${paymentType})`);
      } catch (enqErr: any) {
        console.error("[platform/generate-payment] Recovery enqueue error:", enqErr.message);
      }
    }

    res.json(result);
  } catch (err: any) {
    console.error("[platform/generate-payment] error:", err.message);
    logApiRequest(userId, workspaceId, req, 500, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Mark transactions as seen ──
router.post("/mark-seen", async (req: Request, res: Response) => {
  try {
    const { ids, workspaceId } = req.body;
    if (!ids?.length || !workspaceId) return res.json({ updated: 0 });

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("transactions")
      .update({ viewed_at: new Date().toISOString() })
      .in("id", ids)
      .eq("workspace_id", workspaceId)
      .is("viewed_at", null)
      .select("id");

    if (error) {
      console.error("[mark-seen] error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ updated: data?.length || 0 });
  } catch (err: any) {
    console.error("[mark-seen] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Mark tab seen (all transactions of a category, no date filter) ──
router.post("/mark-tab-seen", async (req: Request, res: Response) => {
  try {
    const { workspaceId, tab } = req.body;
    if (!workspaceId || !tab) return res.json({ updated: 0 });

    const sb = getServiceClient();
    const now = new Date().toISOString();

    if (tab === "rejeitados") {
      // OR condition: status=rejeitado OR (type=yampi_cart AND status=abandonado)
      const [r1, r2] = await Promise.all([
        sb.from("transactions")
          .update({ viewed_at: now })
          .eq("workspace_id", workspaceId)
          .is("viewed_at", null)
          .eq("status", "rejeitado")
          .select("id"),
        sb.from("transactions")
          .update({ viewed_at: now })
          .eq("workspace_id", workspaceId)
          .is("viewed_at", null)
          .eq("type", "yampi_cart")
          .eq("status", "abandonado")
          .select("id"),
      ]);
      const total = (r1.data?.length || 0) + (r2.data?.length || 0);
      return res.json({ updated: total });
    }

    let query = sb
      .from("transactions")
      .update({ viewed_at: now })
      .eq("workspace_id", workspaceId)
      .is("viewed_at", null);

    switch (tab) {
      case "aprovados":
        query = query.eq("status", "aprovado");
        break;
      case "boletos-gerados":
        query = query.eq("type", "boleto").eq("status", "pendente");
        break;
      case "pix-cartao-pendentes":
        query = query.in("type", ["pix", "cartao", "card"]).eq("status", "pendente");
        break;
      default:
        return res.json({ updated: 0 });
    }

    const { data, error } = await query.select("id");
    if (error) {
      console.error("[mark-tab-seen] error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ updated: data?.length || 0 });
  } catch (err: any) {
    console.error("[mark-tab-seen] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /member-products — list member products by phone variations ──
router.get("/member-products", async (req: Request, res: Response) => {
  try {
    const phones = (req.query.phones as string || "").split(",").filter(Boolean);
    const workspace_id = req.query.workspace_id as string;
    if (!phones.length || !workspace_id) {
      return res.status(400).json({ error: "phones and workspace_id required" });
    }
    const sb = getServiceClient();

    // Step 1: fetch member_products without embedded join
    const { data: mpRows, error: mpError } = await sb
      .from("member_products")
      .select("id, phone, is_active, product_id")
      .eq("workspace_id", workspace_id)
      .in("phone", phones);
    if (mpError) throw mpError;
    if (!mpRows?.length) return res.json([]);

    // Step 2: fetch product names separately
    const productIds = Array.from(new Set(mpRows.map((r: any) => r.product_id).filter(Boolean)));
    const productMap: Record<string, string> = {};
    if (productIds.length) {
      const { data: prods } = await sb
        .from("delivery_products")
        .select("id, name")
        .in("id", productIds);
      for (const p of prods || []) productMap[p.id] = p.name;
    }

    // Step 3: merge
    const result = mpRows.map((mp: any) => ({
      ...mp,
      delivery_products: mp.product_id && productMap[mp.product_id]
        ? { name: productMap[mp.product_id] }
        : null,
    }));

    res.json(result);
  } catch (err: any) {
    console.error("[member-products] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
