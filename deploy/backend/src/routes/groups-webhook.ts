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
    let updatedMemberCount = 0;
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
          const newCount = Math.max(0, (current.member_count || 0) + increment);
          updatedMemberCount = newCount;
          await sb
            .from("group_selected")
            .update({ member_count: newCount })
            .eq("workspace_id", inst.workspace_id)
            .eq("group_jid", groupJid);
        }
      } else {
        const { data: current } = await sb
          .from("group_selected")
          .select("member_count")
          .eq("workspace_id", inst.workspace_id)
          .eq("group_jid", groupJid)
          .maybeSingle();
        updatedMemberCount = current?.member_count || 0;
      }
    }

    // ── Upsert group_daily_stats ──
    const todayBrt = new Date(new Date().getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const additions = action === "add" ? participants.length : 0;
    const removals = action === "remove" ? participants.length : 0;

    // Try upsert via raw SQL through RPC or simple logic
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
        total_members: updatedMemberCount,
      }).eq("id", existingStat.id);
    } else {
      await sb.from("group_daily_stats").insert({
        workspace_id: inst.workspace_id,
        date: todayBrt,
        group_jid: groupJid,
        group_name: sg?.group_name || "",
        additions,
        removals,
        total_members: updatedMemberCount,
      });
    }

    // ── Update member_count inside group_smart_links JSONB (real-time) ──
    const incrementSL = action === "add" ? participants.length : action === "remove" ? -participants.length : 0;
    if (incrementSL !== 0) {
      try {
        const { data: affectedLinks } = await sb
          .from("group_smart_links")
          .select("id, group_links")
          .eq("workspace_id", inst.workspace_id)
          .eq("is_active", true);

        if (affectedLinks && affectedLinks.length > 0) {
          for (const sl of affectedLinks) {
            const groupLinks = (sl.group_links as any[]) || [];
            let changed = false;
            for (const gl of groupLinks) {
              if (gl.group_jid === groupJid) {
                gl.member_count = Math.max(0, (gl.member_count || 0) + incrementSL);
                changed = true;
              }
            }
            if (changed) {
              await sb.from("group_smart_links").update({ group_links: groupLinks }).eq("id", sl.id);
            }
          }
        }
      } catch (e: any) {
        console.warn("[groups-webhook] Failed to update smart link member_count:", e.message);
      }
    }

    res.json({ ok: true, events: rows.length });
  } catch (err: any) {
    console.error("[groups-webhook] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
