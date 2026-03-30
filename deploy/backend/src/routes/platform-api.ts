import { Router, Request, Response, NextFunction } from "express";
import { getServiceClient } from "../lib/supabase";


const router = Router();

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
async function resolveUserByApiKey(req: Request, res: Response): Promise<string | null> {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey || apiKey.length < 32) {
    res.status(401).json({ error: "Missing or invalid X-API-Key header" });
    return null;
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("platform_connections")
    .select("user_id, enabled")
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

  return data.user_id;
}

// Apply rate limiting to all routes
router.use(rateLimit);

// ── Ping / Health check (no auth required) ──
router.get("/ping", (_req, res) => {
  res.json({ ok: true, service: "platform-api", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════
// CONTACTS / CLIENTES
// ═══════════════════════════════════════════════════

// GET /api/platform/contacts
router.get("/contacts", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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
  if (error) return res.status(500).json({ error: error.message });

  res.json({ data: data || [], count: data?.length || 0, offset, limit });
});

// GET /api/platform/contacts/:phone
router.get("/contacts/:phone", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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
    return res.status(404).json({ error: "Contact not found" });
  }

  res.json({
    contact: convRes.data[0],
    all_instances: convRes.data,
    tags: (tagsRes.data || []).map((t: any) => t.tag_name),
    reminders: remindersRes.data || [],
  });
});

// POST /api/platform/contacts (upsert by phone)
router.post("/contacts", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data, created: false });
  }

  const { data, error } = await sb
    .from("conversations")
    .insert({
      user_id: userId,
      remote_jid: remoteJid,
      phone_number: cleaned,
      contact_name: name || null,
      instance_name: instance_name || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data, created: true });
});

// ═══════════════════════════════════════════════════
// TRANSACTIONS / PAGAMENTOS
// ═══════════════════════════════════════════════════

// GET /api/platform/transactions
router.get("/transactions", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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
  if (error) return res.status(500).json({ error: error.message });

  res.json({ data: data || [], count: data?.length || 0, offset, limit });
});

// POST /api/platform/transactions
router.post("/transactions", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

  const { amount, type, status, description, customer_name, customer_email, customer_phone, customer_document, external_id, source, metadata } = req.body;
  if (amount === undefined || amount === null) return res.status(400).json({ error: "amount is required" });

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("transactions")
    .insert({
      user_id: userId,
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

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

// PATCH /api/platform/transactions/:id
router.patch("/transactions/:id", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Transaction not found" });

  res.json({ data });
});

// POST /api/platform/transactions/webhook (receive external status updates)
router.post("/transactions/webhook", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Transaction not found for this external_id" });

  res.json({ data });
});

// ═══════════════════════════════════════════════════
// TAGS / SEGMENTAÇÃO
// ═══════════════════════════════════════════════════

// GET /api/platform/tags?phone=X
router.get("/tags", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  if (!phone) return res.status(400).json({ error: "phone query param is required" });

  const remoteJid = `${phone}@s.whatsapp.net`;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from("contact_tags")
    .select("id, tag_name, created_at")
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data || [] });
});

// POST /api/platform/tags
router.post("/tags", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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
    .insert({ user_id: userId, remote_jid: remoteJid, tag_name: tag_name.trim() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data, created: true });
});

// DELETE /api/platform/tags
router.delete("/tags", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// REMINDERS / LEMBRETES
// ═══════════════════════════════════════════════════

// GET /api/platform/reminders
router.get("/reminders", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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
  if (error) return res.status(500).json({ error: error.message });

  res.json({ data: data || [], count: data?.length || 0, offset, limit });
});

// POST /api/platform/reminders
router.post("/reminders", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

// PATCH /api/platform/reminders/:id
router.patch("/reminders/:id", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Reminder not found" });

  res.json({ data });
});

// DELETE /api/platform/reminders/:id
router.delete("/reminders/:id", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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

  if (error) return res.status(500).json({ error: error.message });

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
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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
    res.json({
      ok: true,
      message_id: result?.key?.id || null,
      instance: instanceName,
    });
  } catch (err: any) {
    console.error("[platform-api] send-message error:", err.message);
    res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

// POST /api/platform/send-media
router.post("/send-media", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

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
    res.json({ ok: true, message_id: result?.key?.id || null, instance: instanceName });
  } catch (err: any) {
    console.error("[platform-api] send-media error:", err.message);
    res.status(500).json({ error: err.message || "Failed to send media" });
  }
});

// POST /api/platform/validate-number
router.post("/validate-number", async (req, res) => {
  const userId = await resolveUserByApiKey(req, res);
  if (!userId) return;

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone is required" });

  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 8) return res.status(400).json({ error: "Invalid phone number" });

  const sb = getServiceClient();

  // Find an active instance for validation
  const { data: instances } = await sb
    .from("whatsapp_instances")
    .select("instance_name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1);

  if (!instances || instances.length === 0) {
    return res.status(400).json({ error: "No active WhatsApp instance found" });
  }

  const instanceName = instances[0].instance_name;

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

    res.json({
      exists,
      is_mobile: exists, // WhatsApp numbers are mobile
      jid: numberInfo?.jid || remoteJid,
      known_contact: conv ? { name: conv.contact_name } : null,
    });
  } catch (err: any) {
    console.error("[platform-api] validate-number error:", err.message);
    res.status(500).json({ error: err.message || "Failed to validate number" });
  }
});

export default router;
