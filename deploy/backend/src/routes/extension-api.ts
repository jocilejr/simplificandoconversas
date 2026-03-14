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
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const sb = getServiceClient();

    const [flowsRes, contactsRes, execRes, instancesRes, recentRes] = await Promise.all([
      sb.from("chatbot_flows").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("active", true),
      sb.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", userId),
      sb.from("flow_executions").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["running", "waiting", "waiting_click", "waiting_reply"]),
      sb.from("whatsapp_instances").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true),
      sb.from("flow_executions")
        .select("id, flow_id, status, remote_jid, created_at, instance_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
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

    res.json({
      activeFlows: flowsRes.count || 0,
      totalContacts: contactsRes.count || 0,
      runningExecutions: execRes.count || 0,
      totalInstances: instancesRes.count || 0,
      recentExecutions: enrichedRecent,
    });
  } catch (err: any) {
    console.error("Dashboard error:", err);
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

  res.json({
    contact: conv || null,
    executions: enriched,
    history: enrichedHistory,
    tags: tags || [],
    instances: instances || [],
  });
});

// ── POST /api/ext/trigger-flow ──
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

  try {
    const executeRes = await fetch("http://localhost:3001/api/execute-flow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.authorization || "",
      },
      body: JSON.stringify({ flowId, remoteJid, instanceName }),
    });

    if (!executeRes.ok) {
      const errText = await executeRes.text();
      console.error("[ext-api] trigger-flow execute error:", executeRes.status, errText);
      return res.status(executeRes.status).json({ error: errText });
    }

    const result = await executeRes.json() as any;
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[ext-api] trigger-flow fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
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

export default router;
