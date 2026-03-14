import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getServiceClient } from "../lib/supabase";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "";

// ── Auth middleware ──
function extractUserId(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    return decoded.sub || null;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response): string | null {
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

// ── GET /api/ext/flows ──
router.get("/flows", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("chatbot_flows")
    .select("id, name, active, instance_names")
    .eq("user_id", userId)
    .eq("active", true)
    .order("name");

  if (error) return res.status(500).json({ error: error.message });
  
  // Also fetch instances
  const { data: instances } = await sb
    .from("whatsapp_instances")
    .select("instance_name, status")
    .eq("user_id", userId)
    .eq("is_active", true);

  res.json({ flows: data || [], instances: instances || [] });
});

// ── GET /api/ext/contact-status?phone=5511... ──
router.get("/contact-status", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const phone = (req.query.phone as string || "").replace(/\D/g, "");
  if (!phone) return res.status(400).json({ error: "phone required" });

  const sb = getServiceClient();

  // Find conversation by phone_number or remote_jid
  const remoteJid = `${phone}@s.whatsapp.net`;
  const { data: convs } = await sb
    .from("conversations")
    .select("id, remote_jid, contact_name, phone_number, lid")
    .eq("user_id", userId)
    .or(`remote_jid.eq.${remoteJid},phone_number.eq.${phone}`);

  const conv = convs?.[0];
  const jid = conv?.remote_jid || remoteJid;

  // Active flow executions
  const { data: executions } = await sb
    .from("flow_executions")
    .select("id, flow_id, status, current_node_index, waiting_node_id, instance_name, created_at")
    .eq("user_id", userId)
    .eq("remote_jid", jid)
    .in("status", ["running", "waiting"]);

  // Enrich with flow names
  const enriched = [];
  if (executions && executions.length > 0) {
    const flowIds = [...new Set(executions.map((e: any) => e.flow_id).filter(Boolean))];
    const { data: flows } = await sb
      .from("chatbot_flows")
      .select("id, name")
      .in("id", flowIds);
    const flowMap = new Map((flows || []).map((f: any) => [f.id, f.name]));
    for (const ex of executions) {
      enriched.push({ ...ex, flow_name: flowMap.get(ex.flow_id) || "Fluxo" });
    }
  }

  // Tags
  const { data: tags } = await sb
    .from("contact_tags")
    .select("tag_name")
    .eq("user_id", userId)
    .eq("remote_jid", jid);

  // Instances
  const { data: instances } = await sb
    .from("whatsapp_instances")
    .select("instance_name, status")
    .eq("user_id", userId)
    .eq("is_active", true);

  res.json({
    contact: conv || null,
    executions: enriched,
    tags: tags || [],
    instances: instances || [],
  });
});

// ── POST /api/ext/trigger-flow ──
router.post("/trigger-flow", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { flowId, phone, instanceName } = req.body;
  if (!flowId || !phone || !instanceName) {
    return res.status(400).json({ error: "flowId, phone, instanceName required" });
  }

  const cleaned = phone.replace(/\D/g, "");
  const remoteJid = `${cleaned}@s.whatsapp.net`;

  const sb = getServiceClient();

  // Verify flow belongs to user
  const { data: flow } = await sb
    .from("chatbot_flows")
    .select("id")
    .eq("id", flowId)
    .eq("user_id", userId)
    .single();

  if (!flow) return res.status(404).json({ error: "Flow not found" });

  // Cancel any existing running executions for this jid
  await sb
    .from("flow_executions")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("remote_jid", remoteJid)
    .in("status", ["running", "waiting"]);

  // Call execute-flow internally
  try {
    const executeRes = await fetch("http://localhost:3001/api/execute-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flowId, remoteJid, instanceName }),
    });
    const result = await executeRes.json();
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ext/pause-flow ──
router.post("/pause-flow", async (req, res) => {
  const userId = requireAuth(req, res);
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

  // Also clean up pending timeouts
  await sb
    .from("flow_timeouts")
    .update({ processed: true })
    .eq("execution_id", executionId)
    .eq("processed", false);

  res.json({ ok: true });
});

export default router;
