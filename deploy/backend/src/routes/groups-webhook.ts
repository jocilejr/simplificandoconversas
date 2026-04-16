import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

/** Extract clean phone number from participant (string or object) */
function extractPhone(p: any): string {
  if (typeof p === "string") return p.replace(/@.*/, "").replace(/\D/g, "");
  const raw = p.phoneNumber || p.id || "";
  return raw.replace(/@.*/, "").replace(/\D/g, "");
}

/** Get Evolution API config for a workspace */
async function getEvolutionConfig(workspaceId: string) {
  const sb = getServiceClient();
  const { data } = await sb
    .from("whatsapp_instances")
    .select("proxy_url")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();

  const baseUrl = data?.proxy_url || process.env.EVOLUTION_API_URL || "http://evolution:8080";
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  return { baseUrl, apiKey };
}

/** Fetch real participant count from Evolution API */
async function fetchRealMemberCount(workspaceId: string, instanceName: string, groupJid: string): Promise<number | null> {
  try {
    const { baseUrl, apiKey } = await getEvolutionConfig(workspaceId);
    const encoded = encodeURIComponent(instanceName);
    const resp = await fetch(`${baseUrl}/group/findGroupInfos/${encoded}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ groupJid }),
    });
    if (resp.ok) {
      const info = await resp.json() as { participants?: unknown[]; size?: number };
      // Evolution API v2 returns participants array or size
      const count = info.participants?.length || info.size || 0;
      return count > 0 ? count : null;
    }
  } catch (e: any) {
    console.warn("[groups-webhook] Failed to fetch real member count:", e.message);
  }
  return null;
}

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

    // Extract clean phone numbers and deduplicate within payload
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

    // Get group name from selected groups
    const { data: sg } = await sb
      .from("group_selected")
      .select("group_name")
      .eq("workspace_id", inst.workspace_id)
      .eq("group_jid", groupJid)
      .maybeSingle();

    // Resolve group name with fallback from webhook payload
    const groupName = sg?.group_name || data.subject || data.groupName || "";

    // ── Temporal deduplication: skip participants already recorded in last 60s ──
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await sb
      .from("group_participant_events")
      .select("participant_jid")
      .eq("workspace_id", inst.workspace_id)
      .eq("group_jid", groupJid)
      .eq("action", action)
      .gte("created_at", cutoff);

    const recentSet = new Set((recent || []).map((r: any) => r.participant_jid));
    const newParticipants = uniqueParticipants.filter(p => !recentSet.has(p));

    if (newParticipants.length === 0) {
      return res.json({ ok: true, events: 0, reason: "all duplicates" });
    }

    const rows = newParticipants.map((phone: string) => ({
      workspace_id: inst.workspace_id,
      user_id: inst.user_id,
      instance_name: instanceName,
      group_jid: groupJid,
      group_name: groupName,
      participant_jid: phone,
      action,
    }));

    await sb.from("group_participant_events").insert(rows);

    // ── Reconcile member_count with real Evolution API data ──
    let updatedMemberCount = 0;
    const realCount = await fetchRealMemberCount(inst.workspace_id, instanceName, groupJid);

    if (realCount !== null) {
      // Use real count from Evolution API — eliminates drift
      updatedMemberCount = realCount;
      await sb
        .from("group_selected")
        .update({ member_count: realCount })
        .eq("workspace_id", inst.workspace_id)
        .eq("group_jid", groupJid);
    } else if (sg) {
      // Fallback: relative increment if API call failed
      const increment = action === "add" ? newParticipants.length : action === "remove" ? -newParticipants.length : 0;
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
    try {
      const todayBrt = new Date(new Date().getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const additions = action === "add" ? newParticipants.length : 0;
      const removals = action === "remove" ? newParticipants.length : 0;

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
          group_name: groupName,
          additions,
          removals,
          total_members: updatedMemberCount,
        });
      }
    } catch (e: any) {
      console.warn("[groups-webhook] Failed to upsert daily stats:", e.message);
    }

    // ── Update member_count inside group_smart_links JSONB (real-time) ──
    // Use realCount if available, otherwise use relative increment
    if (realCount !== null) {
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
                gl.member_count = realCount;
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
    } else {
      const incrementSL = action === "add" ? newParticipants.length : action === "remove" ? -newParticipants.length : 0;
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
    }

    res.json({ ok: true, events: rows.length, realCount });
  } catch (err: any) {
    console.error("[groups-webhook] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
