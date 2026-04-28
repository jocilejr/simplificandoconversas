import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

const VALID_ACTIONS = new Set(["add", "remove"]);

// Threshold: if a single webhook event has more than this many participants with
// action=add, treat it as a reconnect/initial-sync event and discard it.
const BULK_ADD_THRESHOLD = 20;

// Dedup window: ignore events with the same (group, participant, action) within
// this many seconds (handles webhook retry deliveries).
const DEDUP_WINDOW_SECONDS = 60;

/** Extract clean phone number (10–13 digits). Returns "" if invalid. */
function extractPhone(p: any): string {
  const clean = (s: string) => s.replace(/@.*/, "").replace(/\D/g, "");

  if (typeof p === "string") {
    // Always reject @lid string participants — do NOT strip the suffix first
    if (p.includes("@lid")) return "";
    const v = clean(p);
    return v.length >= 10 && v.length <= 13 ? v : "";
  }
  if (typeof p !== "object" || !p) return "";

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

function normalizeAction(raw: any): "add" | "remove" | null {
  if (typeof raw !== "string") return null;
  const a = raw.toLowerCase().trim();
  return VALID_ACTIONS.has(a) ? (a as "add" | "remove") : null;
}

router.post("/events", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const event = String(body.event || "");

    if (!event.includes("group") && !event.includes("participant")) {
      return res.json({ ignored: true, reason: "unrelated_event" });
    }

    const data = body.data || body;
    const instanceName = String(body.instance || body.instanceName || "");
    const groupJid = String(data.groupJid || data.id || "");
    const participants = Array.isArray(data.participants) ? data.participants : [];

    const action = normalizeAction(data.action);
    if (!action) {
      console.log(`[groups-webhook] discard reason=invalid_action received=${data.action ?? "null"}`);
      return res.json({ ignored: true, reason: "invalid_action", received: data.action ?? null });
    }

    if (!instanceName || !groupJid || participants.length === 0) {
      console.log(`[groups-webhook] discard reason=missing_payload instance=${instanceName} group=${groupJid} participants=${participants.length}`);
      return res.json({ ignored: true, reason: "missing_payload" });
    }

    // Discard bulk-add events — these are typically reconnect/initial-sync events
    // where the gateway fires "add" for every existing member in the group.
    if (action === "add" && participants.length > BULK_ADD_THRESHOLD) {
      console.log(`[groups-webhook] discard reason=bulk_add_ignored instance=${instanceName} group=${groupJid} participants=${participants.length} threshold=${BULK_ADD_THRESHOLD}`);
      return res.json({ ignored: true, reason: "bulk_add_ignored", count: participants.length });
    }

    const cleanParticipants = participants.map(extractPhone).filter(Boolean);
    const uniqueParticipants = [...new Set(cleanParticipants)];
    if (uniqueParticipants.length === 0) {
      console.log(`[groups-webhook] discard reason=no_valid_participants instance=${instanceName} group=${groupJid}`);
      return res.json({ ignored: true, reason: "no_valid_participants" });
    }

    const sb = getServiceClient();

    // 1) workspace via instance
    const { data: inst } = await sb
      .from("whatsapp_instances")
      .select("workspace_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!inst) {
      console.log(`[groups-webhook] discard reason=instance_not_found instance=${instanceName}`);
      return res.json({ ignored: true, reason: "instance_not_found" });
    }

    // 2) Verifica se o grupo está em algum smart link do workspace
    const { data: wsLinks } = await sb
      .from("group_smart_links")
      .select("group_links")
      .eq("workspace_id", inst.workspace_id);

    let monitoredName: string | null = null;
    let monitored = false;
    for (const sl of (wsLinks || [])) {
      for (const gl of (Array.isArray(sl.group_links) ? sl.group_links : [])) {
        if (gl?.group_jid === groupJid) {
          monitored = true;
          if (!monitoredName && gl.group_name) monitoredName = gl.group_name;
          break;
        }
      }
      if (monitored && monitoredName) break;
    }

    if (!monitored) {
      console.log(`[groups-webhook] discard reason=group_not_in_smartlink ws=${inst.workspace_id} instance=${instanceName} group=${groupJid}`);
      return res.json({ ignored: true, reason: "group_not_in_smartlink" });
    }

    const groupName = monitoredName || data.subject || data.groupName || null;

    // 3) Dedup: remove participants that already have the same action in the last DEDUP_WINDOW_SECONDS
    // This prevents webhook retry deliveries from creating duplicate rows.
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000).toISOString();
    const { data: recentEvents } = await sb
      .from("group_events")
      .select("participant_jid")
      .eq("workspace_id", inst.workspace_id)
      .eq("group_jid", groupJid)
      .eq("action", action)
      .in("participant_jid", uniqueParticipants)
      .gte("occurred_at", dedupCutoff);

    const recentSet = new Set((recentEvents || []).map((e: any) => e.participant_jid));
    const newParticipants = uniqueParticipants.filter((p) => !recentSet.has(p));

    if (newParticipants.length === 0) {
      console.log(`[groups-webhook] discard reason=dedup_window instance=${instanceName} group=${groupJid} action=${action} all_within_${DEDUP_WINDOW_SECONDS}s`);
      return res.json({ ignored: true, reason: "dedup_window", count: uniqueParticipants.length });
    }

    if (newParticipants.length < uniqueParticipants.length) {
      console.log(`[groups-webhook] dedup: skipping ${uniqueParticipants.length - newParticipants.length} duplicates for group=${groupJid} action=${action}`);
    }

    // 4) INSERT one row per unique new participant
    const rows = newParticipants.map((phone) => ({
      workspace_id: inst.workspace_id,
      instance_name: instanceName,
      group_jid: groupJid,
      group_name: groupName,
      participant_jid: phone,
      action,
      raw_payload: body,
    }));

    const { data: inserted, error: insertErr } = await sb
      .from("group_events")
      .insert(rows)
      .select("id");

    if (insertErr) {
      console.error("[groups-webhook] insert error:", {
        code: (insertErr as any).code,
        message: insertErr.message,
        details: (insertErr as any).details,
        hint: (insertErr as any).hint,
      });
      return res.status(500).json({ error: insertErr.message || "insert_failed" });
    }

    console.log(`[groups-webhook] ok action=${action} ws=${inst.workspace_id} group=${groupJid} inserted=${inserted?.length ?? 0}`);
    res.json({ ok: true, action, inserted: inserted?.length ?? 0 });
  } catch (err: any) {
    console.error("[groups-webhook] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
