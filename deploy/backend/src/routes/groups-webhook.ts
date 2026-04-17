import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

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
  return ""; // discard @lid-only or invalid
}

/* POST /api/groups/webhook/events
   Receives group-participants.update from Evolution API.

   ── REGRA CRÍTICA ──
   Um evento só é registrado quando a tupla (workspace_id, instance_name, group_jid)
   existe em group_selected. Se a instância Y também é membro do grupo 1 mas só a
   instância X selecionou esse grupo para monitorar, eventos vindos da Y são
   silenciosamente descartados. */
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
    const action = data.action || event; // add, remove, promote, demote

    if (!groupJid || participants.length === 0) {
      return res.json({ ignored: true, reason: "no group or participants" });
    }

    // Extract clean phone numbers (rejects invalid/@lid) and deduplicate
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

    // ── FILTRO ESTRITO: (workspace_id, instance_name, group_jid) deve existir em group_selected ──
    // Eventos de outras instâncias (mesmo que estejam no grupo) são descartados.
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

    // Resolve group name with fallback from webhook payload
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

    // Upsert with ignoreDuplicates relies on UNIQUE INDEX (workspace_id, group_jid, action, participant_jid, dedup_bucket)
    const { data: inserted, error: upsertErr } = await sb
      .from("group_participant_events")
      .upsert(rows, {
        onConflict: "workspace_id,group_jid,action,participant_jid,dedup_bucket",
        ignoreDuplicates: true,
      })
      .select("id");

    if (upsertErr) {
      console.warn("[groups-webhook] upsert error:", upsertErr.message);
    }

    const insertedCount = inserted?.length ?? 0;

    // ── Upsert group_daily_stats based on REAL inserted count ──
    if (insertedCount > 0) {
      try {
        const todayBrt = new Date(new Date().getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const additions = action === "add" ? insertedCount : 0;
        const removals = action === "remove" ? insertedCount : 0;

        const { data: existingStat } = await sb
          .from("group_daily_stats")
          .select("id, additions, removals")
          .eq("workspace_id", inst.workspace_id)
          .eq("date", todayBrt)
          .eq("group_jid", groupJid)
          .maybeSingle();

        if (existingStat) {
          await sb.from("group_daily_stats").update({
            additions: (existingStat.additions || 0) + additions,
            removals: (existingStat.removals || 0) + removals,
          }).eq("id", existingStat.id);
        } else {
          await sb.from("group_daily_stats").insert({
            workspace_id: inst.workspace_id,
            date: todayBrt,
            group_jid: groupJid,
            group_name: groupName,
            additions,
            removals,
            total_members: 0,
          });
        }
      } catch (e: any) {
        console.warn("[groups-webhook] Failed to upsert daily stats:", e.message);
      }
    }

    res.json({ ok: true, events: insertedCount, attempted: rows.length });
  } catch (err: any) {
    console.error("[groups-webhook] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
