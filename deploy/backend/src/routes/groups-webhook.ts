import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

/** Ações válidas que contabilizamos. Qualquer outro valor é descartado. */
const VALID_ACTIONS = new Set(["add", "remove", "promote", "demote"]);

/** Extract clean phone number (12-13 digits). Returns "" if invalid (e.g., @lid without phoneNumber). */
function extractPhone(p: any): string {
  const clean = (s: string) => s.replace(/@.*/, "").replace(/\D/g, "");

  if (typeof p === "string") {
    const v = clean(p);
    return v.length >= 10 && v.length <= 13 ? v : "";
  }
  if (typeof p !== "object" || !p) return "";

  // Always prefer phoneNumber over id (id may be temporary @lid)
  const pn = typeof p.phoneNumber === "string" ? p.phoneNumber : "";
  if (pn && !pn.includes("@lid")) {
    const v = clean(pn);
    if (v.length >= 10 && v.length <= 13) return v;
  }
  const id = typeof p.id === "string" ? p.id : "";
  if (id && !id.includes("@lid")) {
    const v = clean(id);
    if (v.length >= 10 && v.length <= 13) return v;
  }
  return "";
}

/** Normaliza action: só aceita add/remove/promote/demote (rejeita "group-participants.update" etc). */
function normalizeAction(raw: any): string | null {
  if (typeof raw !== "string") return null;
  const a = raw.toLowerCase().trim();
  return VALID_ACTIONS.has(a) ? a : null;
}

/* POST /api/groups/webhook/events
   Recebe group-participants.update da Evolution API.

   ── REGRAS ──
   1. action DEVE ser add/remove/promote/demote. Qualquer outro valor é descartado.
   2. Só registra se a tupla (workspace_id, instance_name, group_jid) existir em group_selected.
   3. INSERT simples (sem upsert/dedup) — espelha comportamento do whats-grupos de referência. */
router.post("/events", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const event = body.event || "";

    if (!event.includes("group") && !event.includes("participant")) {
      return res.json({ ignored: true });
    }

    const data = body.data || body;
    const instanceName = body.instance || body.instanceName || "";
    const groupJid = data.groupJid || data.id || "";
    const participants = data.participants || [];

    // ── action deve vir do payload `data.action`. Nunca derivar de `event`. ──
    const action = normalizeAction(data.action);
    if (!action) {
      return res.json({
        ignored: true,
        reason: `invalid or missing action (received: ${data.action ?? "null"})`,
      });
    }

    if (!groupJid || participants.length === 0) {
      return res.json({ ignored: true, reason: "no group or participants" });
    }

    // Extract clean phone numbers (rejects invalid/@lid) and deduplicate per request
    const cleanParticipants = participants.map(extractPhone).filter(Boolean);
    const uniqueParticipants = [...new Set(cleanParticipants)];

    if (uniqueParticipants.length === 0) {
      return res.json({ ignored: true, reason: "no valid participants" });
    }

    // Resolve workspace from instance
    const sb = getServiceClient();
    const { data: inst } = await sb
      .from("whatsapp_instances")
      .select("workspace_id, user_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!inst) return res.json({ ignored: true, reason: "instance not found" });

    // ── FILTRO ESTRITO: (workspace_id, instance_name, group_jid) em group_selected ──
    const { data: monitored } = await sb
      .from("group_selected")
      .select("id, group_name")
      .eq("workspace_id", inst.workspace_id)
      .eq("instance_name", instanceName)
      .eq("group_jid", groupJid)
      .maybeSingle();

    if (!monitored) {
      return res.json({
        ignored: true,
        reason: "this (instance, group) tuple is not monitored",
      });
    }

    const groupName = monitored.group_name || data.subject || data.groupName || "";

    const rows = uniqueParticipants.map((phone: string) => ({
      workspace_id: inst.workspace_id,
      user_id: inst.user_id,
      instance_name: instanceName,
      group_jid: groupJid,
      group_name: groupName,
      participant_jid: phone,
      action,
    }));

    // ── INSERT simples (sem dedup_bucket) — modelo do whats-grupos ──
    const { data: inserted, error: insertErr } = await sb
      .from("group_participant_events")
      .insert(rows)
      .select("id");

    if (insertErr) {
      console.error("[groups-webhook] insert error:", insertErr.message);
      return res.status(500).json({ error: insertErr.message });
    }

    res.json({ ok: true, events: inserted?.length ?? 0, action });
  } catch (err: any) {
    console.error("[groups-webhook] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
