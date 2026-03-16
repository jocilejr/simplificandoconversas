import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();
const GOTRUE_URL = process.env.GOTRUE_URL || "http://gotrue:9999";

// ── Auth middleware (validates token via GoTrue) ──
async function extractUserId(req: Request): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const resp = await fetch(`${GOTRUE_URL}/user`, {
      headers: { Authorization: auth },
    });
    if (!resp.ok) {
      console.log("[ext-api] Auth validation failed:", resp.status);
      return null;
    }
    const user: any = await resp.json();
    return user.id || null;
  } catch (err) {
    console.log("[ext-api] Auth validation error:", (err as any).message);
    return null;
  }
}

async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const userId = await extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

// ── GET /api/ext/dashboard ──
router.get("/dashboard", async (req, res) => {
  const start = Date.now();
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const sb = getServiceClient();

    const [flowsRes, contactsRes, execRes, instancesRes, recentRes, remindersRes] = await Promise.all([
      sb.from("chatbot_flows").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("active", true),
      sb.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", userId),
      sb.from("flow_executions").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["running", "waiting", "waiting_click", "waiting_reply"]),
      sb.from("whatsapp_instances").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true),
      sb.from("flow_executions")
        .select("id, flow_id, status, remote_jid, created_at, instance_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      sb.from("reminders")
        .select("id, title, description, due_date, completed, contact_name, phone_number")
        .eq("user_id", userId)
        .eq("completed", false)
        .order("due_date", { ascending: true })
        .limit(15),
    ]);

    const recentExecs = recentRes.data || [];
    let enrichedRecent: any[] = [];
    if (recentExecs.length > 0) {
      const flowIds = [...new Set(recentExecs.map((e: any) => e.flow_id).filter(Boolean))];
      const jids = [...new Set(recentExecs.map((e: any) => e.remote_jid).filter(Boolean))];

      const [flowsLookup, convsLookup] = await Promise.all([
        flowIds.length > 0 ? sb.from("chatbot_flows").select("id, name").in("id", flowIds) : { data: [] },
        jids.length > 0 ? sb.from("conversations").select("remote_jid, contact_name, phone_number").eq("user_id", userId).in("remote_jid", jids) : { data: [] },
      ]);

      const flowMap = new Map((flowsLookup.data || []).map((f: any) => [f.id, f.name]));
      const convMap = new Map((convsLookup.data || []).map((c: any) => [c.remote_jid, c.contact_name || c.phone_number]));

      enrichedRecent = recentExecs.map((ex: any) => ({
        ...ex,
        flow_name: flowMap.get(ex.flow_id) || "Fluxo",
        contact_name: convMap.get(ex.remote_jid) || null,
      }));
    }

    console.log(`[ext-api] GET /dashboard ${Date.now() - start}ms`);
    res.json({
      activeFlows: flowsRes.count || 0,
      totalContacts: contactsRes.count || 0,
      runningExecutions: execRes.count || 0,
      totalInstances: instancesRes.count || 0,
      recentExecutions: enrichedRecent,
    });
  } catch (err: any) {
    console.error(`[ext-api] GET /dashboard error (${Date.now() - start}ms):`, err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── GET /api/ext/list-instances ──
router.get("/list-instances", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const sb = getServiceClient();

    const { data: instances } = await sb
      .from("whatsapp_instances")
      .select("id, instance_name, status, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at");

    res.json({ instances: instances || [] });
  } catch (err: any) {
    console.error("List instances error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── GET /api/ext/contact-cross?phone=X ──
router.get("/contact-cross", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  if (!phone) return res.status(400).json({ error: "phone required" });

  const excludeInstance = req.query.excludeInstance as string || "";
  const sb = getServiceClient();

  let query = sb
    .from("conversations")
    .select("id, remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at, lid")
    .eq("user_id", userId)
    .eq("phone_number", phone);

  if (excludeInstance) {
    query = query.neq("instance_name", excludeInstance);
  }

  const { data: conversations } = await query.order("last_message_at", { ascending: false });

  res.json({ conversations: conversations || [] });
});

// ── GET /api/ext/flows ──
router.get("/flows", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("chatbot_flows")
    .select("id, name, active, instance_names")
    .eq("user_id", userId)
    .eq("active", true)
    .order("name");

  if (error) return res.status(500).json({ error: error.message });

  const { data: instances } = await sb
    .from("whatsapp_instances")
    .select("instance_name, status")
    .eq("user_id", userId)
    .eq("is_active", true);

  res.json({ flows: data || [], instances: instances || [] });
});

// ── GET /api/ext/contact-status?phone=5511... ──
router.get("/contact-status", async (req, res) => {
  const start = Date.now();
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  if (!phone) return res.status(400).json({ error: "phone required" });

  const sb = getServiceClient();
  const remoteJid = `${phone}@s.whatsapp.net`;

  const { data: convs } = await sb
    .from("conversations")
    .select("id, remote_jid, contact_name, phone_number, lid")
    .eq("user_id", userId)
    .or(`remote_jid.eq.${remoteJid},phone_number.eq.${phone}`);

  const conv = convs?.[0];
  const jid = conv?.remote_jid || remoteJid;

  const [activeRes, historyRes] = await Promise.all([
    sb.from("flow_executions")
      .select("id, flow_id, status, current_node_index, waiting_node_id, instance_name, created_at")
      .eq("user_id", userId)
      .eq("remote_jid", jid)
      .in("status", ["running", "waiting", "waiting_click", "waiting_reply"]),
    sb.from("flow_executions")
      .select("id, flow_id, status, created_at")
      .eq("user_id", userId)
      .eq("remote_jid", jid)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const executions = activeRes.data || [];
  const historyExecs = historyRes.data || [];

  const allFlowIds = [...new Set([...executions, ...historyExecs].map((e: any) => e.flow_id).filter(Boolean))];
  let flowMap = new Map();
  if (allFlowIds.length > 0) {
    const { data: flows } = await sb.from("chatbot_flows").select("id, name").in("id", allFlowIds);
    flowMap = new Map((flows || []).map((f: any) => [f.id, f.name]));
  }

  const enriched = executions.map((ex: any) => ({ ...ex, flow_name: flowMap.get(ex.flow_id) || "Fluxo" }));
  const enrichedHistory = historyExecs.map((ex: any) => ({ ...ex, flow_name: flowMap.get(ex.flow_id) || "Fluxo" }));

  const { data: tags } = await sb
    .from("contact_tags")
    .select("tag_name")
    .eq("user_id", userId)
    .eq("remote_jid", jid);

  const { data: instances } = await sb
    .from("whatsapp_instances")
    .select("instance_name, status")
    .eq("user_id", userId)
    .eq("is_active", true);

  console.log(`[ext-api] GET /contact-status?phone=${phone} ${Date.now() - start}ms`);
  res.json({
    contact: conv || null,
    executions: enriched,
    history: enrichedHistory,
    tags: tags || [],
    instances: instances || [],
  });
});

// ── POST /api/ext/trigger-flow (async — returns 202 immediately) ──
router.post("/trigger-flow", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { flowId, phone, instanceName } = req.body;
  if (!flowId || !phone || !instanceName) {
    return res.status(400).json({ error: "flowId, phone, instanceName required" });
  }

  const cleaned = phone.replace(/\D/g, "");
  const remoteJid = `${cleaned}@s.whatsapp.net`;

  const sb = getServiceClient();

  const { data: flow } = await sb
    .from("chatbot_flows")
    .select("id")
    .eq("id", flowId)
    .eq("user_id", userId)
    .single();

  if (!flow) return res.status(404).json({ error: "Flow not found" });

  await sb
    .from("flow_executions")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .in("status", ["running", "waiting"]);

  // Respond immediately — execute in background
  res.status(202).json({ ok: true, queued: true });

  // Fire-and-forget execution
  const authHeader = req.headers.authorization || "";
  fetch("http://localhost:3001/api/execute-flow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ flowId, remoteJid, instanceName }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const errText = await r.text();
        console.error("[ext-api] trigger-flow background error:", r.status, errText);
      } else {
        console.log("[ext-api] trigger-flow background completed for", remoteJid);
      }
    })
    .catch((err) => {
      console.error("[ext-api] trigger-flow background fetch error:", err.message);
    });
});

// ── DELETE /api/ext/remove-tag ──
router.delete("/remove-tag", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { remoteJid, tagName } = req.body;
  if (!remoteJid || !tagName) return res.status(400).json({ error: "remoteJid and tagName required" });

  const sb = getServiceClient();
  const { error } = await sb
    .from("contact_tags")
    .delete()
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .eq("tag_name", tagName);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── POST /api/ext/pause-flow ──
router.post("/pause-flow", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { executionId } = req.body;
  if (!executionId) return res.status(400).json({ error: "executionId required" });

  const sb = getServiceClient();

  const { error } = await sb
    .from("flow_executions")
    .update({ status: "cancelled" })
    .eq("id", executionId)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });

  await sb
    .from("flow_timeouts")
    .update({ processed: true })
    .eq("execution_id", executionId)
    .eq("processed", false);

  res.json({ ok: true });
});

// ── GET /api/ext/reminders ──
router.get("/reminders", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const filter = (req.query.filter as string) || "all";
  const sb = getServiceClient();

  let query = sb
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  if (filter === "pending") query = query.eq("completed", false);
  else if (filter === "overdue") query = query.eq("completed", false).lt("due_date", todayStart);
  else if (filter === "today") query = query.gte("due_date", todayStart).lt("due_date", todayEnd);
  else if (filter === "completed") query = query.eq("completed", true);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reminders: data || [] });
});

// ── POST /api/ext/reminders ──
router.post("/reminders", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { title, description, phone_number, contact_name, due_date, remote_jid, instance_name } = req.body;
  if (!title || !due_date || !remote_jid) {
    return res.status(400).json({ error: "title, due_date, remote_jid required" });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reminders")
    .insert({
      user_id: userId,
      title,
      description: description || null,
      phone_number: phone_number || null,
      contact_name: contact_name || null,
      due_date,
      remote_jid,
      instance_name: instance_name || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── PATCH /api/ext/reminders/:id ──
router.patch("/reminders/:id", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { id } = req.params;
  const { completed } = req.body;

  const sb = getServiceClient();
  const { error } = await sb
    .from("reminders")
    .update({ completed })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── GET /api/ext/ai-status?phone=X ──
router.get("/ai-status", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  if (!phone) return res.status(400).json({ error: "phone required" });

  const sb = getServiceClient();
  const remoteJid = `${phone}@s.whatsapp.net`;

  // Find conversation to get the actual remote_jid (might be @lid)
  const { data: conv } = await sb
    .from("conversations")
    .select("remote_jid")
    .eq("user_id", userId)
    .or(`remote_jid.eq.${remoteJid},phone_number.eq.${phone}`)
    .limit(1)
    .maybeSingle();

  const jid = conv?.remote_jid || remoteJid;

  const [replyRes, listenRes] = await Promise.all([
    sb.from("ai_auto_reply_contacts")
      .select("id, enabled")
      .eq("user_id", userId)
      .eq("remote_jid", jid)
      .maybeSingle(),
    sb.from("ai_listen_contacts")
      .select("id, enabled")
      .eq("user_id", userId)
      .eq("remote_jid", jid)
      .maybeSingle(),
  ]);

  res.json({
    reply: replyRes.data ? replyRes.data.enabled : false,
    listen: listenRes.data ? listenRes.data.enabled : false,
    remoteJid: jid,
  });
});

// ── POST /api/ext/ai-reply-toggle ──
router.post("/ai-reply-toggle", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { remoteJid, instanceName, enabled } = req.body;
  if (!remoteJid || !instanceName) return res.status(400).json({ error: "remoteJid, instanceName required" });

  const sb = getServiceClient();

  if (enabled) {
    // Check if any flow is active for this contact
    const { data: activeFlows } = await sb
      .from("flow_executions")
      .select("id")
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid)
      .in("status", ["running", "waiting", "waiting_click", "waiting_reply"])
      .limit(1);

    if (activeFlows && activeFlows.length > 0) {
      return res.status(409).json({ error: "Não é possível ativar IA enquanto um fluxo está ativo para este contato" });
    }

    const { error } = await sb
      .from("ai_auto_reply_contacts")
      .upsert({
        user_id: userId,
        remote_jid: remoteJid,
        instance_name: instanceName,
        enabled: true,
      }, { onConflict: "user_id,remote_jid,instance_name" });

    if (error) return res.status(500).json({ error: error.message });
  } else {
    await sb
      .from("ai_auto_reply_contacts")
      .delete()
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid);
  }

  res.json({ ok: true, enabled });
});

// ── POST /api/ext/ai-listen-toggle ──
router.post("/ai-listen-toggle", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { remoteJid, instanceName, enabled } = req.body;
  if (!remoteJid || !instanceName) return res.status(400).json({ error: "remoteJid, instanceName required" });

  const sb = getServiceClient();

  if (enabled) {
    const { error } = await sb
      .from("ai_listen_contacts")
      .upsert({
        user_id: userId,
        remote_jid: remoteJid,
        instance_name: instanceName,
        enabled: true,
      }, { onConflict: "user_id,remote_jid,instance_name" });

    if (error) return res.status(500).json({ error: error.message });
  } else {
    await sb
      .from("ai_listen_contacts")
      .delete()
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid);
  }

  res.json({ ok: true, enabled });
});

// ── GET /api/ext/ai-config ──
router.get("/ai-config", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const sb = getServiceClient();
  let { data, error } = await sb
    .from("ai_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    // Create default config
    const { data: newConfig, error: insertErr } = await sb
      .from("ai_config")
      .insert({ user_id: userId })
      .select()
      .single();
    if (insertErr) return res.status(500).json({ error: insertErr.message });
    data = newConfig;
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PATCH /api/ext/ai-config ──
router.patch("/ai-config", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { reply_system_prompt, listen_rules, max_context_messages } = req.body;
  const sb = getServiceClient();

  // Upsert config
  const updates: any = {};
  if (reply_system_prompt !== undefined) updates.reply_system_prompt = reply_system_prompt;
  if (listen_rules !== undefined) updates.listen_rules = listen_rules;
  if (max_context_messages !== undefined) updates.max_context_messages = max_context_messages;

  const { error } = await sb
    .from("ai_config")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
