import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";
import { resolveWorkspaceId } from "../lib/workspace";
import crypto from "crypto";

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

// ── Contact resolver helper ──
async function resolveContact(sb: any, userId: string, phone?: string, name?: string, instanceName?: string) {
  if (phone) {
    const remoteJid = `${phone}@s.whatsapp.net`;
    const { data: convs } = await sb
      .from("conversations")
      .select("id, remote_jid, contact_name, phone_number, instance_name, lid")
      .eq("user_id", userId)
      .or(`remote_jid.eq.${remoteJid},phone_number.eq.${phone}`)
      .order("last_message_at", { ascending: false });
    if (convs && convs.length > 0) {
      const match = (instanceName ? convs.find((c: any) => c.instance_name === instanceName) : null) || convs[0];
      return match;
    }
    // Fallback: try partial match on last 8 digits of phone
    const last8 = phone.slice(-8);
    if (last8.length === 8) {
      const { data: partialConvs } = await sb
        .from("conversations")
        .select("id, remote_jid, contact_name, phone_number, instance_name, lid")
        .eq("user_id", userId)
        .like("phone_number", `%${last8}`)
        .order("last_message_at", { ascending: false });
      if (partialConvs && partialConvs.length > 0) {
        const match = (instanceName ? partialConvs.find((c: any) => c.instance_name === instanceName) : null) || partialConvs[0];
        return match;
      }
    }
    return null;
  }
  if (name) {
    // Try case-insensitive search with ilike, prioritize current instance
    const { data: convs } = await sb
      .from("conversations")
      .select("id, remote_jid, contact_name, phone_number, instance_name, lid")
      .eq("user_id", userId)
      .ilike("contact_name", name)
      .order("last_message_at", { ascending: false });
    if (convs && convs.length > 0) {
      const match = (instanceName ? convs.find((c: any) => c.instance_name === instanceName) : null) || convs[0];
      return match;
    }
    // Fallback: extract digits from the name in case it contains a phone-like pattern
    const nameDigits = name.replace(/\D/g, "");
    if (nameDigits.length >= 8) {
      return resolveContact(sb, userId, nameDigits, undefined, instanceName);
    }
    return null;
  }
  return null;
}

// ── GET /api/ext/dashboard ──
router.get("/dashboard", async (req, res) => {
  const start = Date.now();
  const userId = await requireAuth(req, res);
  if (!userId) return;
  const workspaceId = await resolveWorkspaceId(userId);

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

    // Sort reminders: today (Brasilia) first, then by due_date
    const allReminders = remindersRes.data || [];
    const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const todayStart = new Date(brNow.getFullYear(), brNow.getMonth(), brNow.getDate()).getTime();
    const todayEnd = todayStart + 86400000;

    const sortedReminders = allReminders.sort((a: any, b: any) => {
      const aTime = new Date(a.due_date).getTime();
      const bTime = new Date(b.due_date).getTime();
      const aIsToday = aTime >= todayStart && aTime < todayEnd;
      const bIsToday = bTime >= todayStart && bTime < todayEnd;
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      return aTime - bTime;
    }).slice(0, 10);

    console.log(`[ext-api] GET /dashboard ${Date.now() - start}ms`);
    res.json({
      activeFlows: flowsRes.count || 0,
      totalContacts: contactsRes.count || 0,
      runningExecutions: execRes.count || 0,
      totalInstances: instancesRes.count || 0,
      recentExecutions: enrichedRecent,
      reminders: sortedReminders,
    });
  } catch (err: any) {
    console.error(`[ext-api] GET /dashboard error (${Date.now() - start}ms):`, err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── GET /api/ext/list-workspaces ──
router.get("/list-workspaces", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const sb = getServiceClient();

    const { data: memberships } = await sb
      .from("workspace_members")
      .select("workspace_id, role, workspaces(id, name, slug, logo_url)")
      .eq("user_id", userId)
      .order("created_at");

    const workspaces = (memberships || []).map((m: any) => ({
      id: m.workspaces?.id || m.workspace_id,
      name: m.workspaces?.name || "Workspace",
      slug: m.workspaces?.slug || "",
      logo_url: m.workspaces?.logo_url || null,
      role: m.role,
    }));

    res.json({ workspaces });
  } catch (err: any) {
    console.error("List workspaces error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── GET /api/ext/list-instances ──
router.get("/list-instances", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const requestedWorkspaceId = req.query.workspaceId as string || null;
  const workspaceId = requestedWorkspaceId || await resolveWorkspaceId(userId);

  try {
    const sb = getServiceClient();

    let query = sb
      .from("whatsapp_instances")
      .select("id, instance_name, status, is_active")
      .eq("is_active", true)
      .order("created_at");

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data: instances } = await query;

    res.json({ instances: instances || [] });
  } catch (err: any) {
    console.error("List instances error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── GET /api/ext/contact-cross?phone=X or ?name=X ──
router.get("/contact-cross", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;
  const workspaceId = await resolveWorkspaceId(userId);

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  const name = (req.query.name as string || "").trim();
  if (!phone && !name) return res.status(400).json({ error: "phone or name required" });

  const excludeInstance = req.query.excludeInstance as string || "";
  const sb = getServiceClient();

  let query: any;
  if (phone) {
    query = sb
      .from("conversations")
      .select("id, remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at, lid")
      .eq("user_id", userId)
      .eq("phone_number", phone);
  } else {
    query = sb
      .from("conversations")
      .select("id, remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at, lid")
      .eq("user_id", userId)
      .ilike("contact_name", name);
  }

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
  const workspaceId = await resolveWorkspaceId(userId);

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
  const workspaceId = await resolveWorkspaceId(userId);

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  const name = (req.query.name as string || "").trim();
  const instanceName = (req.query.instance as string || "").trim();
  if (!phone && !name) return res.status(400).json({ error: "phone or name required" });

  const sb = getServiceClient();
  const conv = await resolveContact(sb, userId, phone || undefined, name || undefined, instanceName || undefined);

  const jid = conv?.remote_jid || (phone ? `${phone}@s.whatsapp.net` : null);
  if (!jid) {
    return res.json({ contact: null, executions: [], history: [], tags: [], instances: [] });
  }

  let activeQuery = sb.from("flow_executions")
    .select("id, flow_id, status, current_node_index, waiting_node_id, instance_name, created_at")
    .eq("user_id", userId)
    .eq("remote_jid", jid)
    .in("status", ["running", "waiting", "waiting_click", "waiting_reply"]);
  // Filter by instance if provided — avoids showing flows from OTHER instances as active
  if (instanceName) activeQuery = activeQuery.eq("instance_name", instanceName);

  const [activeRes, historyRes] = await Promise.all([
    activeQuery,
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
  const workspaceId = await resolveWorkspaceId(userId);

  const { flowId, phone, instanceName, remoteJid: bodyRemoteJid, name: bodyName } = req.body;
  if (!flowId || !instanceName) {
    return res.status(400).json({ error: "flowId, instanceName required" });
  }

  let remoteJid: string;
  if (bodyRemoteJid) {
    remoteJid = bodyRemoteJid;
  } else if (phone) {
    const cleaned = phone.replace(/\D/g, "");
    remoteJid = `${cleaned}@s.whatsapp.net`;
  } else if (bodyName) {
    // Resolve by name
    const sb2 = getServiceClient();
    const conv = await resolveContact(sb2, userId, undefined, bodyName, instanceName);
    if (!conv?.remote_jid) return res.status(400).json({ error: "Contato não encontrado pelo nome" });
    remoteJid = conv.remote_jid;
  } else {
    return res.status(400).json({ error: "phone, remoteJid or name required" });
  }

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
    .in("status", ["running", "waiting", "waiting_click", "waiting_reply"]);

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
  const workspaceId = await resolveWorkspaceId(userId);

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
  const workspaceId = await resolveWorkspaceId(userId);

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
  const workspaceId = await resolveWorkspaceId(userId);

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
  const workspaceId = await resolveWorkspaceId(userId);

  const { title, description, phone_number, contact_name, due_date, remote_jid, instance_name } = req.body;
  if (!title || !due_date || !remote_jid) {
    return res.status(400).json({ error: "title, due_date, remote_jid required" });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reminders")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
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
  const workspaceId = await resolveWorkspaceId(userId);

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

// ── GET /api/ext/ai-status?phone=X or ?name=X ──
router.get("/ai-status", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;
  const workspaceId = await resolveWorkspaceId(userId);

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  const name = (req.query.name as string || "").trim();
  if (!phone && !name) return res.status(400).json({ error: "phone or name required" });

  const sb = getServiceClient();
  const conv = await resolveContact(sb, userId, phone || undefined, name || undefined);

  const jid = conv?.remote_jid || (phone ? `${phone}@s.whatsapp.net` : null);
  if (!jid) {
    return res.json({ reply: false, listen: false, remoteJid: null });
  }

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
    listen: listenRes.data ? listenRes.data.enabled : true,
    remoteJid: jid,
  });
});

// ── POST /api/ext/ai-reply-toggle ──
router.post("/ai-reply-toggle", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;
  const workspaceId = await resolveWorkspaceId(userId);

  const { remoteJid, instanceName, enabled } = req.body;
  if (!remoteJid || !instanceName) return res.status(400).json({ error: "remoteJid, instanceName required" });

  const sb = getServiceClient();

  if (enabled) {
    // Check if any flow is active for this contact ON THIS SPECIFIC INSTANCE
    const { data: activeFlows } = await sb
      .from("flow_executions")
      .select("id")
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid)
      .eq("instance_name", instanceName)
      .in("status", ["running", "waiting", "waiting_click", "waiting_reply"])
      .limit(1);

    if (activeFlows && activeFlows.length > 0) {
      return res.status(409).json({ error: "Não é possível ativar IA enquanto um fluxo está ativo para este contato nesta instância" });
    }

    const { error } = await sb
      .from("ai_auto_reply_contacts")
      .upsert({
        user_id: userId,
        workspace_id: workspaceId,
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
  const workspaceId = await resolveWorkspaceId(userId);

  const { remoteJid, instanceName, enabled } = req.body;
  if (!remoteJid || !instanceName) return res.status(400).json({ error: "remoteJid, instanceName required" });

  const sb = getServiceClient();

  if (enabled) {
    // Remove opt-out record (default is enabled)
    await sb
      .from("ai_listen_contacts")
      .delete()
      .eq("user_id", userId)
      .eq("remote_jid", remoteJid);
  } else {
    // Insert opt-out record
    const { error } = await sb
      .from("ai_listen_contacts")
      .upsert({
        user_id: userId,
        workspace_id: workspaceId,
        remote_jid: remoteJid,
        instance_name: instanceName,
        enabled: false,
      }, { onConflict: "user_id,remote_jid,instance_name" });

    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true, enabled });
});

// ── GET /api/ext/ai-config ──
router.get("/ai-config", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;
  const workspaceId = await resolveWorkspaceId(userId);

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
  const workspaceId = await resolveWorkspaceId(userId);

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

// ── GET /api/ext/platform-key ──
router.get("/platform-key", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;
  const workspaceId = await resolveWorkspaceId(userId);

  const sb = getServiceClient();
  const { data } = await sb
    .from("platform_connections")
    .select("credentials, enabled, created_at")
    .eq("user_id", userId)
    .eq("platform", "custom_api")
    .maybeSingle();

  if (!data) return res.json({ key: null });

  const creds = data.credentials as any;
  res.json({
    key: creds?.api_key || null,
    enabled: data.enabled,
    created_at: data.created_at,
  });
});

// ── POST /api/ext/generate-platform-key ──
router.post("/generate-platform-key", async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;
  const workspaceId = await resolveWorkspaceId(userId);

  const newKey = crypto.randomBytes(32).toString("hex");
  const sb = getServiceClient();

  // Check if one already exists
  const { data: existing } = await sb
    .from("platform_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", "custom_api")
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("platform_connections")
      .update({ credentials: { api_key: newKey }, enabled: true, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return res.status(500).json({ error: error.message });
  } else {
    const { error } = await sb
      .from("platform_connections")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        platform: "custom_api",
        credentials: { api_key: newKey },
        enabled: true,
      });
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ key: newKey });
});

export default router;
