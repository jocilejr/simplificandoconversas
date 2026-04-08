import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

/* POST /api/groups/webhook/events
   Receives group-participants.update from Evolution API */
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

    // Resolve workspace from instance
    const sb = getServiceClient();
    const { data: inst } = await sb
      .from("whatsapp_instances")
      .select("workspace_id, user_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!inst) return res.json({ ignored: true, reason: "instance not found" });

    // Get group name from selected groups
    const { data: sg } = await sb
      .from("group_selected")
      .select("group_name")
      .eq("workspace_id", inst.workspace_id)
      .eq("group_jid", groupJid)
      .maybeSingle();

    const rows = participants.map((p: string) => ({
      workspace_id: inst.workspace_id,
      user_id: inst.user_id,
      instance_name: instanceName,
      group_jid: groupJid,
      group_name: sg?.group_name || "",
      participant_jid: p,
      action,
    }));

    await sb.from("group_participant_events").insert(rows);

    // Update member count if group is selected
    if (sg) {
      const increment = action === "add" ? participants.length : action === "remove" ? -participants.length : 0;
      if (increment !== 0) {
        const { data: current } = await sb
          .from("group_selected")
          .select("member_count")
          .eq("workspace_id", inst.workspace_id)
          .eq("group_jid", groupJid)
          .maybeSingle();
        if (current) {
          await sb
            .from("group_selected")
            .update({ member_count: Math.max(0, (current.member_count || 0) + increment) })
            .eq("workspace_id", inst.workspace_id)
            .eq("group_jid", groupJid);
        }
      }
    }

    res.json({ ok: true, events: rows.length });
  } catch (err: any) {
    console.error("[groups-webhook] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
