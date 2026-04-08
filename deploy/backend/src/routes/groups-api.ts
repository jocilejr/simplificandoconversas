import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

/* ─── helpers ─── */
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

async function validateInstanceOwnership(instanceName: string, workspaceId: string): Promise<boolean> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", instanceName)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return !!data;
}

/* ─── POST /fetch-groups ─── */
router.post("/fetch-groups", async (req: Request, res: Response) => {
  try {
    const { instanceName, workspaceId } = req.body;
    if (!instanceName || !workspaceId) return res.status(400).json({ error: "instanceName and workspaceId required" });

    const valid = await validateInstanceOwnership(instanceName, workspaceId);
    if (!valid) return res.status(403).json({ error: "Instance does not belong to workspace" });

    const { baseUrl, apiKey } = await getEvolutionConfig(workspaceId);
    const encoded = encodeURIComponent(instanceName);
    const resp = await fetch(`${baseUrl}/group/fetchAllGroups/${encoded}?getParticipants=true`, {
      headers: { apikey: apiKey },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: txt });
    }

    const raw: any = await resp.json();
    const list = Array.isArray(raw) ? raw : (raw?.groups || []);
    const groups = list.map((g: any) => ({
      jid: g.id || g.jid || g.groupJid,
      name: g.subject || g.name || "Sem nome",
      memberCount: g.participants?.length || g.size || 0,
    }));

    res.json(groups);
  } catch (err: any) {
    console.error("[groups-api] fetch-groups error:", err?.message || err?.details || JSON.stringify(err));
    res.status(500).json({ error: err?.message || err?.details || err?.hint || "Unknown error" });
  }
});

/* ─── POST /select-groups ─── */
router.post("/select-groups", async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, instanceName, groups } = req.body;
    if (!workspaceId || !userId || !instanceName || !Array.isArray(groups))
      return res.status(400).json({ error: "Missing fields" });

    const sb = getServiceClient();
    const rows = groups.map((g: any) => ({
      workspace_id: workspaceId,
      user_id: userId,
      instance_name: instanceName,
      group_jid: g.jid,
      group_name: g.name,
      member_count: g.memberCount || 0,
    }));

    const { data, error } = await sb.from("group_selected").upsert(rows, { onConflict: "workspace_id,group_jid" }).select();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error("[groups-api] select-groups error:", err?.message || err?.details || JSON.stringify(err));
    res.status(500).json({ error: err?.message || err?.details || err?.hint || "Unknown error" });
  }
});

/* ─── GET /selected-groups ─── */
router.get("/selected-groups", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("group_selected")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── DELETE /selected-groups/:id ─── */
router.delete("/selected-groups/:id", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { error } = await sb.from("group_selected").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Campaigns CRUD ─── */
router.get("/campaigns", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("group_campaigns")
      .select("*, group_scheduled_messages(*)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, name, description, instanceName, groupJids } = req.body;
    if (!workspaceId || !userId || !name || !instanceName)
      return res.status(400).json({ error: "Missing fields" });

    const sb = getServiceClient();
    const { data: campaign, error } = await sb
      .from("group_campaigns")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        name,
        description: description || "",
        instance_name: instanceName,
        group_jids: groupJids || [],
        is_active: false,
      })
      .select()
      .single();
    if (error) throw error;

    res.json(campaign);
  } catch (err: any) {
    console.error("[groups-api] create campaign error:", JSON.stringify(err, null, 2));
    res.status(500).json({ error: err?.message || err?.details || err?.hint || JSON.stringify(err) });
  }
});

router.put("/campaigns/:id", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { name, description, instanceName, groupJids, isActive } = req.body;
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (instanceName !== undefined) update.instance_name = instanceName;
    if (groupJids !== undefined) update.group_jids = groupJids;
    if (isActive !== undefined) update.is_active = isActive;

    const { data, error } = await sb
      .from("group_campaigns")
      .update(update)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/campaigns/:id", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { error } = await sb.from("group_campaigns").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── POST /campaigns/:id/enqueue ─── */
router.post("/campaigns/:id/enqueue", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { data: campaign, error: cErr } = await sb
      .from("group_campaigns")
      .select("*, group_scheduled_messages(*)")
      .eq("id", req.params.id)
      .single();
    if (cErr || !campaign) return res.status(404).json({ error: "Campaign not found" });

    const batch = `batch-${Date.now()}`;
    const queueItems: any[] = [];

    const messages = (campaign as any).group_scheduled_messages || [];
    for (const msg of messages) {
      if (!msg.is_active) continue;
      for (const jid of campaign.group_jids) {
        const { data: sg } = await sb
          .from("group_selected")
          .select("group_name")
          .eq("workspace_id", campaign.workspace_id)
          .eq("group_jid", jid)
          .maybeSingle();

        queueItems.push({
          workspace_id: campaign.workspace_id,
          user_id: campaign.user_id,
          campaign_id: campaign.id,
          scheduled_message_id: msg.id,
          group_jid: jid,
          group_name: sg?.group_name || "",
          instance_name: campaign.instance_name,
          message_type: msg.message_type,
          content: msg.content,
          status: "pending",
          execution_batch: batch,
        });
      }
    }

    if (queueItems.length === 0) return res.json({ enqueued: 0 });

    const { error } = await sb.from("group_message_queue").insert(queueItems);
    if (error) throw error;

    res.json({ enqueued: queueItems.length, batch });
  } catch (err: any) {
    console.error("[groups-api] enqueue error:", err?.message || err?.details || JSON.stringify(err));
    res.status(500).json({ error: err?.message || err?.details || err?.hint || "Unknown error" });
  }
});

/* ─── Scheduled Messages CRUD ─── */
router.get("/campaigns/:id/messages", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("group_scheduled_messages")
      .select("*")
      .eq("campaign_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/campaigns/:id/messages", async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, messageType, content, scheduleType, scheduledAt, cronExpression, intervalMinutes } = req.body;
    if (!workspaceId || !userId) return res.status(400).json({ error: "Missing fields" });

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("group_scheduled_messages")
      .insert({
        campaign_id: req.params.id,
        workspace_id: workspaceId,
        user_id: userId,
        message_type: messageType || "text",
        content: content || {},
        schedule_type: scheduleType || "once",
        scheduled_at: scheduledAt || null,
        cron_expression: cronExpression || null,
        interval_minutes: intervalMinutes || null,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error("[groups-api] create message error:", err?.message || err?.details || JSON.stringify(err));
    res.status(500).json({ error: err?.message || err?.details || err?.hint || "Unknown error" });
  }
});

router.put("/campaigns/:id/messages/:msgId", async (req: Request, res: Response) => {
  try {
    const { messageType, content, scheduleType, scheduledAt, cronExpression, intervalMinutes } = req.body;
    const update: any = {};
    if (messageType !== undefined) update.message_type = messageType;
    if (content !== undefined) update.content = content;
    if (scheduleType !== undefined) update.schedule_type = scheduleType;
    if (scheduledAt !== undefined) update.scheduled_at = scheduledAt;
    if (cronExpression !== undefined) update.cron_expression = cronExpression;
    if (intervalMinutes !== undefined) update.interval_minutes = intervalMinutes;

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("group_scheduled_messages")
      .update(update)
      .eq("id", req.params.msgId)
      .eq("campaign_id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/campaigns/:id/messages/:msgId", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { error } = await sb
      .from("group_scheduled_messages")
      .delete()
      .eq("id", req.params.msgId)
      .eq("campaign_id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/campaigns/:id/messages/:msgId/toggle", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { data: msg, error: fErr } = await sb
      .from("group_scheduled_messages")
      .select("is_active")
      .eq("id", req.params.msgId)
      .single();
    if (fErr || !msg) return res.status(404).json({ error: "Message not found" });

    const { data, error } = await sb
      .from("group_scheduled_messages")
      .update({ is_active: !msg.is_active })
      .eq("id", req.params.msgId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── GET /queue-status ─── */
router.get("/queue-status", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("group_message_queue")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── POST /queue/process ─── */
router.post("/queue/process", async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    const { data: pending, error } = await sb
      .from("group_message_queue")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) throw error;
    if (!pending || pending.length === 0) return res.json({ processed: 0 });

    const { baseUrl, apiKey } = await getEvolutionConfig(workspaceId);
    let sent = 0;
    let failed = 0;

    for (const item of pending) {
      await sb.from("group_message_queue").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", item.id);

      try {
        const encoded = encodeURIComponent(item.instance_name);
        const content = item.content as any;

        if (item.message_type === "text") {
          const r = await fetch(`${baseUrl}/message/sendText/${encoded}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: item.group_jid, text: content.text || "" }),
          });
          if (!r.ok) throw new Error(await r.text());
        } else {
          const r = await fetch(`${baseUrl}/message/sendMedia/${encoded}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({
              number: item.group_jid,
              mediatype: item.message_type,
              media: content.mediaUrl || "",
              caption: content.caption || "",
              fileName: content.fileName || "",
            }),
          });
          if (!r.ok) throw new Error(await r.text());
        }

        await sb.from("group_message_queue").update({ status: "sent", completed_at: new Date().toISOString() }).eq("id", item.id);
        sent++;
      } catch (sendErr: any) {
        await sb.from("group_message_queue").update({ status: "failed", error_message: sendErr.message, completed_at: new Date().toISOString() }).eq("id", item.id);
        failed++;
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    res.json({ processed: pending.length, sent, failed });
  } catch (err: any) {
    console.error("[groups-api] queue/process error:", err?.message || err?.details || JSON.stringify(err));
    res.status(500).json({ error: err?.message || err?.details || err?.hint || "Unknown error" });
  }
});

/* ─── POST /queue/cancel-batch ─── */
router.post("/queue/cancel-batch", async (req: Request, res: Response) => {
  try {
    const { batch } = req.body;
    if (!batch) return res.status(400).json({ error: "batch required" });

    const sb = getServiceClient();
    const { error } = await sb
      .from("group_message_queue")
      .update({ status: "cancelled" })
      .eq("execution_batch", batch)
      .eq("status", "pending");
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
