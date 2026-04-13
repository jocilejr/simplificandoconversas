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

/* ─── helpers: normalização de JID ─── */
const normalizeJid = (jid: string) => (jid || "").replace(/\+/g, "").split(":")[0].split("@")[0].replace(/\D/g, "");

/* ─── helper: resolver ownerJid com fallback em camadas ─── */
async function resolveOwnerJid(baseUrl: string, apiKey: string, instanceName: string): Promise<string> {
  const encoded = encodeURIComponent(instanceName);

  try {
    const resp = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
    });
    if (resp.ok) {
      const instances = (await resp.json()) as any[];
      const thisInst = instances.find((i: any) => i.instance?.instanceName === instanceName);
      const owner = thisInst?.instance?.owner || "";
      if (owner) {
        console.log("[groups-api] ownerJid via fetchInstances:", owner);
        return owner;
      }
    }
  } catch (e: any) {
    console.warn("[groups-api] fetchInstances failed:", e?.message);
  }

  try {
    const resp = await fetch(`${baseUrl}/instance/connectionState/${encoded}`, {
      headers: { apikey: apiKey },
    });
    if (resp.ok) {
      const data: any = await resp.json();
      const wuid = data?.instance?.wuid || data?.wuid || "";
      if (wuid) {
        console.log("[groups-api] ownerJid via connectionState:", wuid);
        return wuid;
      }
    }
  } catch (e: any) {
    console.warn("[groups-api] connectionState failed:", e?.message);
  }

  try {
    const resp = await fetch(`${baseUrl}/instance/connect/${encoded}`, {
      headers: { apikey: apiKey },
    });
    if (resp.ok) {
      const data: any = await resp.json();
      const num = data?.instance?.owner || data?.number || data?.wuid || "";
      if (num) {
        console.log("[groups-api] ownerJid via connect:", num);
        return num;
      }
    }
  } catch (e: any) {
    console.warn("[groups-api] connect fallback failed:", e?.message);
  }

  return "";
}

/* ─── helper: calcular next_run_at ─── */
function computeNextRunAt(scheduleType: string, scheduledAt: string | null, cronExpression: string | null, intervalMinutes: number | null): string | null {
  const now = new Date();

  switch (scheduleType) {
    case "once": {
      if (!scheduledAt) return null;
      const dt = new Date(scheduledAt);
      return dt > now ? dt.toISOString() : null;
    }
    case "daily": {
      if (!scheduledAt) return null;
      const ref = new Date(scheduledAt);
      const next = new Date(now);
      next.setHours(ref.getHours(), ref.getMinutes(), 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
    case "weekly": {
      if (!scheduledAt) return null;
      const ref = new Date(scheduledAt);
      const targetDay = ref.getDay();
      const next = new Date(now);
      next.setHours(ref.getHours(), ref.getMinutes(), 0, 0);
      let daysAhead = targetDay - now.getDay();
      if (daysAhead < 0) daysAhead += 7;
      if (daysAhead === 0 && next <= now) daysAhead = 7;
      next.setDate(next.getDate() + daysAhead);
      return next.toISOString();
    }
    case "monthly": {
      if (!scheduledAt) return null;
      const ref = new Date(scheduledAt);
      const targetDate = ref.getDate();
      const next = new Date(now.getFullYear(), now.getMonth(), targetDate, ref.getHours(), ref.getMinutes(), 0, 0);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next.toISOString();
    }
    case "interval": {
      if (!intervalMinutes || intervalMinutes <= 0) return null;
      return new Date(now.getTime() + intervalMinutes * 60000).toISOString();
    }
    default:
      return scheduledAt || null;
  }
}

/* ─── helper: calcular PRÓXIMO next_run_at após execução ─── */
function computeNextRunAfterExecution(scheduleType: string, scheduledAt: string | null, cronExpression: string | null, intervalMinutes: number | null): string | null {
  const now = new Date();

  switch (scheduleType) {
    case "once":
      return null; // desativa
    case "daily": {
      if (!scheduledAt) return null;
      const ref = new Date(scheduledAt);
      const next = new Date(now);
      next.setHours(ref.getHours(), ref.getMinutes(), 0, 0);
      next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
    case "weekly": {
      if (!scheduledAt) return null;
      const ref = new Date(scheduledAt);
      const next = new Date(now);
      next.setHours(ref.getHours(), ref.getMinutes(), 0, 0);
      next.setDate(next.getDate() + 7);
      return next.toISOString();
    }
    case "monthly": {
      if (!scheduledAt) return null;
      const ref = new Date(scheduledAt);
      const next = new Date(now.getFullYear(), now.getMonth() + 1, ref.getDate(), ref.getHours(), ref.getMinutes(), 0, 0);
      return next.toISOString();
    }
    case "interval": {
      if (!intervalMinutes || intervalMinutes <= 0) return null;
      return new Date(now.getTime() + intervalMinutes * 60000).toISOString();
    }
    default:
      return null;
  }
}

/* ─── POST /debug-groups (temporário) ─── */
router.post("/debug-groups", async (req: Request, res: Response) => {
  try {
    const { instanceName, workspaceId } = req.body;
    if (!instanceName || !workspaceId) return res.status(400).json({ error: "instanceName and workspaceId required" });

    const { baseUrl, apiKey } = await getEvolutionConfig(workspaceId);
    const encoded = encodeURIComponent(instanceName);
    const result: any = { instanceName, baseUrl };

    try {
      const r = await fetch(`${baseUrl}/group/fetchAllGroups/${encoded}?getParticipants=false`, { headers: { apikey: apiKey } });
      result.rawFetchAllGroups = r.ok ? await r.json() : { status: r.status, body: await r.text() };
    } catch (e: any) { result.rawFetchAllGroups = { error: e.message }; }

    try {
      const r = await fetch(`${baseUrl}/instance/fetchInstances`, { headers: { apikey: apiKey } });
      result.rawFetchInstances = r.ok ? await r.json() : { status: r.status, body: await r.text() };
    } catch (e: any) { result.rawFetchInstances = { error: e.message }; }

    try {
      const r = await fetch(`${baseUrl}/instance/connectionState/${encoded}`, { headers: { apikey: apiKey } });
      result.rawConnectionState = r.ok ? await r.json() : { status: r.status, body: await r.text() };
    } catch (e: any) { result.rawConnectionState = { error: e.message }; }

    const rawList = Array.isArray(result.rawFetchAllGroups) ? result.rawFetchAllGroups : (result.rawFetchAllGroups?.groups || []);
    const gus = rawList.filter((g: any) => {
      const jid = g.id || g.jid || g.groupJid || "";
      return jid.endsWith("@g.us");
    });

    result.rawFindGroupInfos = [];
    for (const g of gus) {
      const jid = g.id || g.jid || g.groupJid || "";
      try {
        const r = await fetch(`${baseUrl}/group/findGroupInfos/${encoded}?groupJid=${encodeURIComponent(jid)}`, { headers: { apikey: apiKey } });
        const body = r.ok ? await r.json() : { status: r.status, body: await r.text() };
        result.rawFindGroupInfos.push({ jid, ...(body as Record<string, unknown>) });
      } catch (e: any) {
        result.rawFindGroupInfos.push({ jid, error: e.message });
      }
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── POST /fetch-groups ─── */
router.post("/fetch-groups", async (req: Request, res: Response) => {
  try {
    const { instanceName, workspaceId } = req.body;
    if (!instanceName || !workspaceId) return res.status(400).json({ error: "instanceName and workspaceId required" });

    const valid = await validateInstanceOwnership(instanceName, workspaceId);
    if (!valid) return res.status(403).json({ error: "Instance does not belong to workspace" });

    const { baseUrl, apiKey } = await getEvolutionConfig(workspaceId);
    const encoded = encodeURIComponent(instanceName);

    const resp = await fetch(`${baseUrl}/group/fetchAllGroups/${encoded}?getParticipants=false`, {
      headers: { apikey: apiKey },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: txt });
    }

    const raw: any = await resp.json();
    const list = Array.isArray(raw) ? raw : (raw?.groups || []);

    const gusOnly = list.filter((g: any) => {
      const jid = g.id || g.jid || g.groupJid || "";
      return jid.endsWith("@g.us");
    });

    console.log(`[groups-api] Total raw: ${list.length}, @g.us candidates: ${gusOnly.length}`);

    const ownerJid = await resolveOwnerJid(baseUrl, apiKey, instanceName);
    const ownerNorm = normalizeJid(ownerJid);
    const hasOwner = !!ownerNorm;

    console.log(`[groups-api] ownerJid resolved: "${ownerJid}", ownerNorm: "${ownerNorm}", hasOwner: ${hasOwner}`);

    const groups: any[] = [];
    const discarded: string[] = [];

    for (const g of gusOnly) {
      const jid = g.id || g.jid || g.groupJid || "";

      try {
        const infoResp = await fetch(`${baseUrl}/group/findGroupInfos/${encoded}?groupJid=${encodeURIComponent(jid)}`, {
          headers: { apikey: apiKey },
        });

        if (!infoResp.ok) {
          discarded.push(`${jid} (findGroupInfos failed: ${infoResp.status})`);
          continue;
        }

        const info: any = await infoResp.json();
        const participants = info?.participants || [];
        const subject = info?.subject || info?.name || g.subject || g.name || "";

        if (!Array.isArray(participants) || participants.length === 0) {
          discarded.push(`${jid} (no participants in real-time info)`);
          continue;
        }

        if (hasOwner) {
          const found = participants.some((p: any) => {
            const pJid = typeof p === "string" ? p : (p.id || p.jid || "");
            return normalizeJid(pJid) === ownerNorm;
          });

          if (!found) {
            discarded.push(`${jid} (owner not in participants)`);
            continue;
          }
        }

        groups.push({
          jid,
          name: subject || "Sem nome",
          memberCount: participants.length || info?.size || 0,
        });
      } catch (e: any) {
        discarded.push(`${jid} (error: ${e?.message})`);
      }
    }

    console.log(`[groups-api] Active groups: ${groups.length}, Discarded: ${discarded.length}, mode: ${hasOwner ? "owner-validated" : "fallback-metadata"}`);
    if (discarded.length > 0) {
      console.log(`[groups-api] Discarded (first 10):`, discarded.slice(0, 10));
    }

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

    const nextRunAt = computeNextRunAt(scheduleType || "once", scheduledAt || null, cronExpression || null, intervalMinutes || null);

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
        next_run_at: nextRunAt,
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

    // Recalculate next_run_at if schedule changed
    if (scheduleType !== undefined || scheduledAt !== undefined || intervalMinutes !== undefined) {
      // Need to get current values to merge
      const sb2 = getServiceClient();
      const { data: current } = await sb2
        .from("group_scheduled_messages")
        .select("schedule_type, scheduled_at, cron_expression, interval_minutes")
        .eq("id", req.params.msgId)
        .single();

      const finalScheduleType = scheduleType ?? current?.schedule_type ?? "once";
      const finalScheduledAt = scheduledAt ?? current?.scheduled_at ?? null;
      const finalCron = cronExpression ?? current?.cron_expression ?? null;
      const finalInterval = intervalMinutes ?? current?.interval_minutes ?? null;

      update.next_run_at = computeNextRunAt(finalScheduleType, finalScheduledAt, finalCron, finalInterval);
    }

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
      .select("is_active, schedule_type, scheduled_at, cron_expression, interval_minutes")
      .eq("id", req.params.msgId)
      .single();
    if (fErr || !msg) return res.status(404).json({ error: "Message not found" });

    const newActive = !msg.is_active;
    const updateData: any = { is_active: newActive };

    // Recalculate next_run_at when activating
    if (newActive) {
      updateData.next_run_at = computeNextRunAt(msg.schedule_type, msg.scheduled_at, msg.cron_expression, msg.interval_minutes);
    }

    const { data, error } = await sb
      .from("group_scheduled_messages")
      .update(updateData)
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

/* ─── POST /queue/process — agora chamado pelo cron automaticamente ─── */
router.post("/queue/process", async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();

    // Get spam config
    const { data: spamConfig } = await sb
      .from("group_queue_config")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const maxPerGroup = spamConfig?.max_messages_per_group ?? 3;
    const perMinutes = spamConfig?.per_minutes ?? 60;
    const delayMs = spamConfig?.delay_between_sends_ms ?? 3000;

    const { data: pending, error } = await sb
      .from("group_message_queue")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!pending || pending.length === 0) return res.json({ processed: 0, sent: 0, failed: 0, skipped: 0 });

    const { baseUrl, apiKey } = await getEvolutionConfig(workspaceId);
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Track sends per group in this window
    const windowStart = new Date(Date.now() - perMinutes * 60000).toISOString();

    for (const item of pending) {
      // Rate limit check: count recent sends to this group
      const { count } = await sb
        .from("group_message_queue")
        .select("id", { count: "exact", head: true })
        .eq("group_jid", item.group_jid)
        .eq("workspace_id", workspaceId)
        .eq("status", "sent")
        .gte("completed_at", windowStart);

      if ((count || 0) >= maxPerGroup) {
        console.log(`[groups-queue] ⏸ Rate limit: ${item.group_jid} has ${count}/${maxPerGroup} sends in ${perMinutes}min window`);
        skipped++;
        continue;
      }

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

      // Delay between sends
      await new Promise((r) => setTimeout(r, delayMs));
    }

    res.json({ processed: sent + failed, sent, failed, skipped });
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

/* ─── Anti-Spam Config Endpoints ─── */
router.get("/spam-config", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("group_queue_config")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;

    res.json(data || { max_messages_per_group: 3, per_minutes: 60, delay_between_sends_ms: 3000 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/spam-config", async (req: Request, res: Response) => {
  try {
    const { workspaceId, maxMessagesPerGroup, perMinutes, delayBetweenSendsMs } = req.body;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    const { data: existing } = await sb
      .from("group_queue_config")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const values: any = {};
    if (maxMessagesPerGroup !== undefined) values.max_messages_per_group = maxMessagesPerGroup;
    if (perMinutes !== undefined) values.per_minutes = perMinutes;
    if (delayBetweenSendsMs !== undefined) values.delay_between_sends_ms = delayBetweenSendsMs;

    if (existing) {
      const { data, error } = await sb
        .from("group_queue_config")
        .update(values)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } else {
      const { data, error } = await sb
        .from("group_queue_config")
        .insert({ workspace_id: workspaceId, ...values })
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Smart Links CRUD ─── */
router.get("/smart-links", async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    let query = sb.from("group_smart_links").select("*").eq("workspace_id", workspaceId);
    if (campaignId) query = query.eq("campaign_id", campaignId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/smart-links", async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, slug, maxMembersPerGroup, instanceName, groupLinks: inputGroupLinks, campaignId } = req.body;
    if (!workspaceId || !userId || !slug) return res.status(400).json({ error: "Missing fields" });

    const sb = getServiceClient();

    // Accept groupLinks directly from body (standalone mode)
    let groupLinks: any[] = inputGroupLinks || [];

    // Fallback: build from campaign if campaignId provided and no groupLinks
    if (groupLinks.length === 0 && campaignId) {
      const { data: campaign } = await sb.from("group_campaigns").select("group_jids, instance_name").eq("id", campaignId).single();
      if (campaign?.group_jids) {
        for (const jid of campaign.group_jids) {
          const { data: gs } = await sb.from("group_selected").select("group_name, member_count")
            .eq("workspace_id", workspaceId).eq("group_jid", jid).maybeSingle();
          groupLinks.push({
            group_jid: jid,
            group_name: gs?.group_name || "",
            member_count: gs?.member_count || 0,
            invite_url: "",
          });
        }
      }
    }

    const { data, error } = await sb.from("group_smart_links").insert({
      workspace_id: workspaceId,
      user_id: userId,
      campaign_id: campaignId || null,
      instance_name: instanceName || null,
      slug,
      max_members_per_group: maxMembersPerGroup || 200,
      group_links: groupLinks,
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error("[groups-api] create smart-link error:", err?.message || err?.details || JSON.stringify(err));
    res.status(500).json({ error: err?.message || err?.details || err?.hint || "Unknown error" });
  }
});

router.put("/smart-links/:id", async (req: Request, res: Response) => {
  try {
    const { slug, maxMembersPerGroup, groupLinks, isActive } = req.body;
    const update: any = {};
    if (slug !== undefined) update.slug = slug;
    if (maxMembersPerGroup !== undefined) update.max_members_per_group = maxMembersPerGroup;
    if (groupLinks !== undefined) update.group_links = groupLinks;
    if (isActive !== undefined) update.is_active = isActive;

    const sb = getServiceClient();
    const { data, error } = await sb.from("group_smart_links").update(update).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/smart-links/:id", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { error } = await sb.from("group_smart_links").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── POST /smart-links/sync-invite — busca invite codes via Evolution API ─── */
router.post("/smart-links/sync-invite", async (req: Request, res: Response) => {
  try {
    const { smartLinkId, workspaceId } = req.body;
    if (!smartLinkId || !workspaceId) return res.status(400).json({ error: "smartLinkId and workspaceId required" });

    const sb = getServiceClient();
    const { data: sl, error: slErr } = await sb.from("group_smart_links").select("*").eq("id", smartLinkId).single();
    if (slErr || !sl) return res.status(404).json({ error: "Smart link not found" });

    // Use instance_name from smart link directly, fallback to campaign
    let instanceName = (sl as any).instance_name;
    if (!instanceName && (sl as any).campaign_id) {
      const { data: camp } = await sb.from("group_campaigns").select("instance_name").eq("id", (sl as any).campaign_id).maybeSingle();
      instanceName = camp?.instance_name;
    }
    if (!instanceName) return res.status(400).json({ error: "No instance linked" });

    const { baseUrl, apiKey } = await getEvolutionConfig(workspaceId);
    const encoded = encodeURIComponent(instanceName);
    const groupLinks = (sl.group_links as any[]) || [];
    let synced = 0;

    for (const gl of groupLinks) {
      try {
        const r = await fetch(`${baseUrl}/group/inviteCode/${encoded}?groupJid=${encodeURIComponent(gl.group_jid)}`, {
          headers: { apikey: apiKey },
        });
        if (r.ok) {
          const body: any = await r.json();
          const code = body?.inviteCode || body?.code || body?.invite || "";
          if (code) {
            gl.invite_url = `https://chat.whatsapp.com/${code}`;
            synced++;
          }
        }
      } catch (e: any) {
        console.warn(`[smart-link] Failed to get invite for ${gl.group_jid}:`, e.message);
      }

      // Also update member_count from group_selected
      try {
        const { data: gs } = await sb.from("group_selected").select("member_count")
          .eq("workspace_id", workspaceId).eq("group_jid", gl.group_jid).maybeSingle();
        if (gs) gl.member_count = gs.member_count;
      } catch {}
    }

    await sb.from("group_smart_links").update({ group_links: groupLinks }).eq("id", smartLinkId);
    res.json({ synced, groupLinks });
  } catch (err: any) {
    console.error("[smart-link] sync-invite error:", err?.message);
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── GET /smart-link-redirect — rota PÚBLICA (sem auth) ─── */
router.get("/smart-link-redirect", async (req: Request, res: Response) => {
  try {
    let slug = (req.query.slug as string || "").trim();
    if (!slug) return res.status(400).json({ error: "slug required" });

    // Support -get mode: returns URL as text
    const getText = slug.endsWith("-get");
    if (getText) slug = slug.replace(/-get$/, "");

    const sb = getServiceClient();
    const { data: sl, error } = await sb.from("group_smart_links").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (error) throw error;
    if (!sl) return res.status(404).json({ error: "Link não encontrado ou inativo" });

    const groupLinks = (sl.group_links as any[]) || [];
    if (groupLinks.length === 0) return res.status(404).json({ error: "Nenhum grupo configurado" });

    const maxMembers = sl.max_members_per_group || 200;

    // Find best group: least members below limit
    const available = groupLinks
      .filter((g: any) => g.invite_url && g.status !== "banned" && (g.member_count || 0) < maxMembers)
      .sort((a: any, b: any) => (a.member_count || 0) - (b.member_count || 0));

    let chosen: any = null;

    if (available.length > 0) {
      // Primary rule: group with fewest members
      chosen = available[0];
    } else {
      // Fallback round-robin: distribute across ALL groups that have invite_url
      const withUrl = groupLinks.filter((g: any) => g.invite_url && g.status !== "banned");
      if (withUrl.length === 0) return res.status(404).json({ error: "Nenhum grupo com URL de convite disponível" });

      const currentIndex = sl.current_group_index || 0;
      chosen = withUrl[currentIndex % withUrl.length];

      // Increment index for next access (fire-and-forget)
      Promise.resolve(sb.from("group_smart_links")
        .update({ current_group_index: (currentIndex + 1) % withUrl.length })
        .eq("id", sl.id))
        .catch((e: any) => console.warn("[smart-link] Failed to update index:", e.message));

      console.log(`[smart-link] Fallback round-robin: slug=${slug} index=${currentIndex} → ${chosen.group_name}`);
    }

    // Record click (fire-and-forget)
    Promise.resolve(sb.from("group_smart_link_clicks").insert({
      smart_link_id: sl.id,
      group_jid: chosen.group_jid,
      redirected_to: chosen.invite_url,
    })).catch((e: any) => console.warn("[smart-link] Failed to record click:", e.message));

    if (getText) {
      return res.type("text/plain").send(chosen.invite_url);
    }

    // If accessed directly via browser (nginx proxy from /r/g/), redirect 302
    const acceptHeader = (req.headers.accept || "").toLowerCase();
    if (!acceptHeader.includes("application/json")) {
      return res.redirect(302, chosen.invite_url);
    }

    res.json({ redirect_url: chosen.invite_url, group_name: chosen.group_name });
  } catch (err: any) {
    console.error("[smart-link] redirect error:", err?.message);
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── GET /smart-link-stats ─── */
router.get("/smart-link-stats", async (req: Request, res: Response) => {
  try {
    const smartLinkId = req.query.smartLinkId as string;
    if (!smartLinkId) return res.status(400).json({ error: "smartLinkId required" });

    const sb = getServiceClient();
    const { data, error } = await sb.from("group_smart_link_clicks").select("group_jid, created_at")
      .eq("smart_link_id", smartLinkId).order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;

    // Aggregate by group
    const byGroup: Record<string, number> = {};
    for (const click of (data || [])) {
      byGroup[click.group_jid] = (byGroup[click.group_jid] || 0) + 1;
    }

    res.json({ totalClicks: data?.length || 0, byGroup, clicks: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── POST /smart-links/sync-all — sync periódico (cron) de member_count e invite_url ─── */
router.post("/smart-links/sync-all", async (req: Request, res: Response) => {
  try {
    const sb = getServiceClient();
    const { data: smartLinks, error } = await sb.from("group_smart_links").select("*").eq("is_active", true);
    if (error) throw error;
    if (!smartLinks || smartLinks.length === 0) return res.json({ synced: 0, message: "No active smart links" });

    const results: any[] = [];

    for (const sl of smartLinks) {
      const instanceName = (sl as any).instance_name;
      if (!instanceName) {
        results.push({ id: sl.id, slug: sl.slug, status: "skipped", reason: "no instance" });
        continue;
      }

      try {
        const { baseUrl, apiKey } = await getEvolutionConfig(sl.workspace_id);
        const encoded = encodeURIComponent(instanceName);
        const groupLinks = (sl.group_links as any[]) || [];
        let synced = 0;

        // ── Check instance connection state before processing groups ──
        let instanceOnline = false;
        try {
          const stateResp = await fetch(`${baseUrl}/instance/connectionState/${encoded}`, {
            headers: { apikey: apiKey },
            signal: AbortSignal.timeout(5000),
          });
          if (stateResp.ok) {
            const stateBody: any = await stateResp.json();
            const connState = stateBody?.state || stateBody?.instance?.state || "";
            instanceOnline = connState === "open";
          }
        } catch (e: any) {
          console.warn(`[sync-all] Failed to check connectionState for ${instanceName}:`, e.message);
        }

        if (!instanceOnline) {
          // Instance offline — don't touch group statuses, just record the error
          await sb.from("group_smart_links").update({
            last_sync_error: `Instância desconectada (${instanceName})`,
            last_sync_error_at: new Date().toISOString(),
          }).eq("id", sl.id);
          results.push({ id: sl.id, slug: sl.slug, status: "instance_offline", instanceName });
          continue;
        }

        // ── Instance is ONLINE — process each group ──
        for (const gl of groupLinks) {
          try {
            // Fetch real participant count
            const infoResp = await fetch(`${baseUrl}/group/findGroupInfos/${encoded}?groupJid=${encodeURIComponent(gl.group_jid)}`, {
              headers: { apikey: apiKey },
              signal: AbortSignal.timeout(5000),
            });
            if (infoResp.ok) {
              const info: any = await infoResp.json();
              const participants = info?.participants || [];
              if (Array.isArray(participants) && participants.length > 0) {
                gl.member_count = participants.length;
              }
            }
          } catch (e: any) {
            console.warn(`[sync-all] Failed to get info for ${gl.group_jid}:`, e.message);
          }

          try {
            // Refresh invite code
            const r = await fetch(`${baseUrl}/group/inviteCode/${encoded}?groupJid=${encodeURIComponent(gl.group_jid)}`, {
              headers: { apikey: apiKey },
              signal: AbortSignal.timeout(5000),
            });
            if (r.ok) {
              const body: any = await r.json();
              const code = body?.inviteCode || body?.code || body?.invite || "";
              if (code) {
                gl.invite_url = `https://chat.whatsapp.com/${code}`;
                gl.status = "active";
                synced++;
              } else {
                // Instance online but no code returned — mark as banned
                gl.status = "banned";
                gl.invite_url = "";
                console.warn(`[sync-all] Group ${gl.group_jid} returned empty inviteCode — marked as banned`);
              }
            } else {
              // Instance online but inviteCode request failed — mark as banned
              gl.status = "banned";
              gl.invite_url = "";
              console.warn(`[sync-all] Group ${gl.group_jid} inviteCode failed (${r.status}) — marked as banned`);
            }
          } catch (e: any) {
            // Instance online but request error — mark as banned
            gl.status = "banned";
            gl.invite_url = "";
            console.warn(`[sync-all] Group ${gl.group_jid} inviteCode error — marked as banned:`, e.message);
          }
        }

        await sb.from("group_smart_links").update({
          group_links: groupLinks,
          last_successful_sync_at: new Date().toISOString(),
          last_sync_error: null,
          last_sync_error_at: null,
        }).eq("id", sl.id);

        results.push({ id: sl.id, slug: sl.slug, status: "ok", synced });
      } catch (e: any) {
        console.error(`[sync-all] Error syncing smart link ${sl.id}:`, e.message);
        await sb.from("group_smart_links").update({
          last_sync_error: e.message || "Unknown error",
          last_sync_error_at: new Date().toISOString(),
        }).eq("id", sl.id);
        results.push({ id: sl.id, slug: sl.slug, status: "error", error: e.message });
      }
    }

    console.log(`[sync-all] Processed ${results.length} smart links`);
    res.json({ results });
  } catch (err: any) {
    console.error("[sync-all] error:", err?.message);
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── POST /import-backup ─── */
router.post("/import-backup", async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, backup } = req.body;
    if (!workspaceId || !userId || !backup) {
      return res.status(400).json({ error: "Missing workspaceId, userId or backup" });
    }

    if (backup.version !== 1) {
      return res.status(400).json({ error: `Unsupported backup version: ${backup.version}` });
    }

    const data = backup.data || {};
    const campaigns = data.campaigns || [];
    const scheduledMessages = data.scheduled_messages || [];

    const sb = getServiceClient();

    // 1. Create campaigns and map old IDs to new IDs
    const campaignIdMap: Record<string, string> = {};
    let campaignsImported = 0;

    for (const c of campaigns) {
      const oldId = c.id;
      const { data: newCampaign, error: cErr } = await sb
        .from("group_campaigns")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          name: c.name || "Campanha Importada",
          description: c.description || "",
          instance_name: c.instance_name || "default",
          group_jids: c.group_ids || c.group_jids || [],
          is_active: false,
        })
        .select("id")
        .single();

      if (cErr) {
        console.error(`[import-backup] Campaign insert error:`, cErr.message);
        continue;
      }

      campaignIdMap[oldId] = newCampaign.id;
      campaignsImported++;
    }

    // 2. Create scheduled messages with remapped campaign IDs
    let messagesImported = 0;
    const messageIds: string[] = [];

    for (const msg of scheduledMessages) {
      const newCampaignId = campaignIdMap[msg.campaign_id];
      if (!newCampaignId) {
        console.warn(`[import-backup] Skipping message with unknown campaign_id: ${msg.campaign_id}`);
        continue;
      }

      const content = msg.content || {};
      const scheduleType = msg.schedule_type || "once";
      const scheduledAt = msg.scheduled_at || null;
      const cronExpression = msg.cron_expression || null;
      const intervalMinutes = msg.interval_minutes || null;
      const nextRunAt = computeNextRunAt(scheduleType, scheduledAt, cronExpression, intervalMinutes);

      const { data: newMsg, error: mErr } = await sb
        .from("group_scheduled_messages")
        .insert({
          campaign_id: newCampaignId,
          workspace_id: workspaceId,
          user_id: userId,
          message_type: msg.message_type || "text",
          content,
          schedule_type: scheduleType,
          scheduled_at: scheduledAt,
          cron_expression: cronExpression,
          interval_minutes: intervalMinutes,
          is_active: msg.is_active ?? true,
          next_run_at: nextRunAt,
        })
        .select("id")
        .single();

      if (mErr) {
        console.error(`[import-backup] Message insert error:`, mErr.message);
        continue;
      }

      messageIds.push(newMsg.id);
      messagesImported++;
    }

    console.log(`[import-backup] Done: ${campaignsImported} campaigns, ${messagesImported} messages`);
    res.json({
      campaignsImported,
      messagesImported,
      mediaUploaded: 0,
      campaignIdMap,
      messageIds,
    });
  } catch (err: any) {
    console.error("[import-backup] error:", err?.message || JSON.stringify(err));
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── POST /import-media ─── */
router.post("/import-media", async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, path: mediaPath, dataUri } = req.body;
    if (!workspaceId || !userId || !mediaPath || !dataUri) {
      return res.status(400).json({ error: "Missing workspaceId, userId, path or dataUri" });
    }

    const base64Match = (dataUri as string).match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).json({ error: "Invalid data URI format" });
    }

    const mimeType = base64Match[1];
    const base64Data = base64Match[2];
    const buffer = Buffer.from(base64Data, "base64");
    const ext = mimeType.split("/")[1]?.split("+")[0] || "bin";
    const storagePath = `${userId}/import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const sb = getServiceClient();
    const { error: uploadErr } = await sb.storage
      .from("chatbot-media")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadErr) {
      console.error(`[import-media] Upload error for ${mediaPath}:`, uploadErr.message);
      return res.status(500).json({ error: uploadErr.message });
    }

    const { data: urlData } = sb.storage.from("chatbot-media").getPublicUrl(storagePath);
    console.log(`[import-media] Uploaded ${mediaPath} → ${urlData.publicUrl}`);
    res.json({ oldPath: mediaPath, newUrl: urlData.publicUrl });
  } catch (err: any) {
    console.error("[import-media] error:", err?.message || JSON.stringify(err));
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── POST /import-remap-media ─── */
router.post("/import-remap-media", async (req: Request, res: Response) => {
  try {
    const { workspaceId, messageIds, mediaUrlMap } = req.body;
    if (!workspaceId || !messageIds || !mediaUrlMap) {
      return res.status(400).json({ error: "Missing workspaceId, messageIds or mediaUrlMap" });
    }

    const sb = getServiceClient();
    let remapped = 0;

    for (const msgId of messageIds) {
      const { data: msg, error: fetchErr } = await sb
        .from("group_scheduled_messages")
        .select("content")
        .eq("id", msgId)
        .eq("workspace_id", workspaceId)
        .single();

      if (fetchErr || !msg) continue;

      let contentStr = JSON.stringify(msg.content || {});
      let changed = false;
      for (const [oldPath, newUrl] of Object.entries(mediaUrlMap)) {
        if (contentStr.includes(oldPath)) {
          contentStr = contentStr.split(oldPath).join(newUrl as string);
          changed = true;
        }
      }

      if (changed) {
        await sb
          .from("group_scheduled_messages")
          .update({ content: JSON.parse(contentStr) })
          .eq("id", msgId);
        remapped++;
      }
    }

    console.log(`[import-remap-media] Remapped ${remapped} messages`);
    res.json({ remapped });
  } catch (err: any) {
    console.error("[import-remap-media] error:", err?.message || JSON.stringify(err));
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── Exportar helpers para uso no cron ─── */
export { computeNextRunAfterExecution, getEvolutionConfig };

export default router;
