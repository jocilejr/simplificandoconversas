import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

/** Apenas add/remove são contabilizados nesta versão. */
const VALID_ACTIONS = new Set(["add", "remove"]);

/** Extract participant identifier from a JID or participant object.
 *  Accepts @s.whatsapp.net (phone), @lid (WhatsApp internal ID), and plain numbers.
 *  Returns "" only if no usable identifier can be found. */
function extractPhone(p: any): string {
  const stripDomain = (s: string) => s.replace(/@.*/, "").replace(/\D/g, "");

  if (typeof p === "string") {
    // @lid: numeric internal ID — accept as-is
    if (p.includes("@lid")) {
      const v = p.replace(/@.*/, "").replace(/\D/g, "");
      return v.length >= 8 ? v : "";
    }
    const v = stripDomain(p);
    return v.length >= 8 ? v : "";
  }
  if (typeof p !== "object" || !p) return "";

  // phoneNumber field (prefer @s.whatsapp.net format)
  const pn = typeof p.phoneNumber === "string" ? p.phoneNumber : "";
  if (pn) {
    if (pn.includes("@lid")) {
      const v = pn.replace(/@.*/, "").replace(/\D/g, "");
      if (v.length >= 8) return v;
    } else {
      const v = stripDomain(pn);
      if (v.length >= 8) return v;
    }
  }
  // id field
  const id = typeof p.id === "string" ? p.id : "";
  if (id) {
    if (id.includes("@lid")) {
      const v = id.replace(/@.*/, "").replace(/\D/g, "");
      if (v.length >= 8) return v;
    }
    const v = stripDomain(id);
    if (v.length >= 8) return v;
  }
  return "";
}

function normalizeAction(raw: any): "add" | "remove" | null {
  if (typeof raw !== "string") return null;
  const a = raw.toLowerCase().trim();
  return VALID_ACTIONS.has(a) ? (a as "add" | "remove") : null;
}

/* POST /api/groups/webhook/events
   Pipeline:
     workspace (via instance_name) → group_smart_links (group_jid em group_links) → INSERT em group_events
   Descarta + log se o grupo não pertence a nenhum smart link do workspace. */
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

    // 3) INSERT cru em group_events (1 linha por participante, sem dedup)
    const rows = uniqueParticipants.map((phone) => ({
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
