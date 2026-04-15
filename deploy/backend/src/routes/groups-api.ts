import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";
import { groupScheduler } from "../lib/group-scheduler";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

/* ─── helper: BRT timezone conversion (UTC-3) ─── */
function brtToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  // BRT = UTC-3, so we add 3 hours to get UTC
  const d = new Date(Date.UTC(year, month, day, hour + 3, minute, 0, 0));
  return d;
}

function getNowBrt(): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number; date: Date } {
  const now = new Date();
  // BRT = UTC-3
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return {
    year: brt.getUTCFullYear(),
    month: brt.getUTCMonth(),
    day: brt.getUTCDate(),
    hour: brt.getUTCHours(),
    minute: brt.getUTCMinutes(),
    dayOfWeek: brt.getUTCDay(),
    date: now,
  };
}

/* ─── calculateNextRunAt — modelo whats-grupos ─── */
export function calculateNextRunAt(msg: { schedule_type: string; content: any }): string | null {
  const content = msg.content || {};
  const scheduleType = msg.schedule_type;

  if (scheduleType === "once") return null;

  const runTime: string = content.runTime || content.time || "08:00";
  const [hhStr, mmStr] = runTime.split(":");
  const hh = parseInt(hhStr || "8", 10);
  const mm = parseInt(mmStr || "0", 10);

  const brt = getNowBrt();

  switch (scheduleType) {
    case "daily": {
      // Next day at runTime BRT
      let nextDay = brt.day + 1;
      const candidate = brtToUtc(brt.year, brt.month, nextDay, hh, mm);
      return candidate.toISOString();
    }

    case "weekly": {
      const weekDays: number[] = content.weekDays || content.weekdays || [];
      if (!Array.isArray(weekDays) || weekDays.length === 0) {
        // Fallback to daily
        return brtToUtc(brt.year, brt.month, brt.day + 1, hh, mm).toISOString();
      }
      // Find the next weekday occurrence
      for (let i = 1; i <= 7; i++) {
        const futureDate = new Date(Date.UTC(brt.year, brt.month, brt.day + i));
        const futureDay = futureDate.getUTCDay();
        if (weekDays.includes(futureDay)) {
          return brtToUtc(brt.year, brt.month, brt.day + i, hh, mm).toISOString();
        }
      }
      // Fallback
      return brtToUtc(brt.year, brt.month, brt.day + 7, hh, mm).toISOString();
    }

    case "monthly": {
      const monthDay = parseInt(content.monthDay || content.customDays || "1", 10);
      // Next month on monthDay
      let nextMonth = brt.month + 1;
      let nextYear = brt.year;
      if (nextMonth > 11) { nextMonth = 0; nextYear++; }
      // If monthDay hasn't passed yet this month, use this month
      const thisMonthCandidate = brtToUtc(brt.year, brt.month, monthDay, hh, mm);
      if (thisMonthCandidate > brt.date) {
        return thisMonthCandidate.toISOString();
      }
      return brtToUtc(nextYear, nextMonth, monthDay, hh, mm).toISOString();
    }

    case "custom": {
      // Custom days of month (e.g. "1,15" or "5")
      const customDaysStr: string = content.customDays || content.monthDay || "";
      const weekDaysCustom: number[] = content.weekDays || content.weekdays || [];

      if (customDaysStr) {
        const days = customDaysStr.split(",").map((d: string) => parseInt(d.trim(), 10)).filter((n: number) => !isNaN(n));
        if (days.length > 0) {
          // Find next day-of-month occurrence
          // Check remaining days this month first
          for (const d of days.sort((a: number, b: number) => a - b)) {
            const candidate = brtToUtc(brt.year, brt.month, d, hh, mm);
            if (candidate > brt.date) return candidate.toISOString();
          }
          // Next month
          let nextMonth = brt.month + 1;
          let nextYear = brt.year;
          if (nextMonth > 11) { nextMonth = 0; nextYear++; }
          const firstDay = days.sort((a: number, b: number) => a - b)[0];
          return brtToUtc(nextYear, nextMonth, firstDay, hh, mm).toISOString();
        }
      }

      // Custom with weekdays
      if (Array.isArray(weekDaysCustom) && weekDaysCustom.length > 0) {
        for (let i = 1; i <= 7; i++) {
          const futureDate = new Date(Date.UTC(brt.year, brt.month, brt.day + i));
          const futureDay = futureDate.getUTCDay();
          if (weekDaysCustom.includes(futureDay)) {
            return brtToUtc(brt.year, brt.month, brt.day + i, hh, mm).toISOString();
          }
        }
      }

      // Fallback to daily
      return brtToUtc(brt.year, brt.month, brt.day + 1, hh, mm).toISOString();
    }

    case "interval": {
      const intervalMinutes = content.intervalMinutes || 60;
      return new Date(Date.now() + intervalMinutes * 60000).toISOString();
    }

    default:
      return null;
  }
}

/* ─── calculateFirstRunAt — para criação de mensagem ─── */
function calculateFirstRunAt(msg: { schedule_type: string; scheduled_at?: string | null; content: any }): string | null {
  if (msg.schedule_type === "once") {
    if (!msg.scheduled_at) return null;
    const dt = new Date(msg.scheduled_at);
    return dt > new Date() ? dt.toISOString() : null;
  }

  const content = msg.content || {};
  const runTime: string = content.runTime || content.time || "08:00";
  const [hhStr, mmStr] = runTime.split(":");
  const hh = parseInt(hhStr || "8", 10);
  const mm = parseInt(mmStr || "0", 10);
  const brt = getNowBrt();

  // Check if today's run time hasn't passed yet
  const todayCandidate = brtToUtc(brt.year, brt.month, brt.day, hh, mm);

  switch (msg.schedule_type) {
    case "daily": {
      if (todayCandidate > brt.date) return todayCandidate.toISOString();
      return brtToUtc(brt.year, brt.month, brt.day + 1, hh, mm).toISOString();
    }

    case "weekly": {
      const weekDays: number[] = content.weekDays || content.weekdays || [];
      if (!Array.isArray(weekDays) || weekDays.length === 0) {
        if (todayCandidate > brt.date) return todayCandidate.toISOString();
        return brtToUtc(brt.year, brt.month, brt.day + 1, hh, mm).toISOString();
      }
      // Check today first if it's a valid weekday
      if (weekDays.includes(brt.dayOfWeek) && todayCandidate > brt.date) {
        return todayCandidate.toISOString();
      }
      // Find next weekday
      for (let i = 1; i <= 7; i++) {
        const futureDate = new Date(Date.UTC(brt.year, brt.month, brt.day + i));
        const futureDay = futureDate.getUTCDay();
        if (weekDays.includes(futureDay)) {
          return brtToUtc(brt.year, brt.month, brt.day + i, hh, mm).toISOString();
        }
      }
      return brtToUtc(brt.year, brt.month, brt.day + 7, hh, mm).toISOString();
    }

    case "monthly": {
      const monthDay = parseInt(content.monthDay || content.customDays || "1", 10);
      const candidate = brtToUtc(brt.year, brt.month, monthDay, hh, mm);
      if (candidate > brt.date) return candidate.toISOString();
      let nextMonth = brt.month + 1;
      let nextYear = brt.year;
      if (nextMonth > 11) { nextMonth = 0; nextYear++; }
      return brtToUtc(nextYear, nextMonth, monthDay, hh, mm).toISOString();
    }

    case "custom": {
      const customDaysStr: string = content.customDays || content.monthDay || "";
      const weekDaysCustom: number[] = content.weekDays || content.weekdays || [];

      if (customDaysStr) {
        const days = customDaysStr.split(",").map((d: string) => parseInt(d.trim(), 10)).filter((n: number) => !isNaN(n));
        for (const d of days.sort((a: number, b: number) => a - b)) {
          const candidate = brtToUtc(brt.year, brt.month, d, hh, mm);
          if (candidate > brt.date) return candidate.toISOString();
        }
        let nextMonth = brt.month + 1;
        let nextYear = brt.year;
        if (nextMonth > 11) { nextMonth = 0; nextYear++; }
        return brtToUtc(nextYear, nextMonth, days[0], hh, mm).toISOString();
      }

      if (Array.isArray(weekDaysCustom) && weekDaysCustom.length > 0) {
        if (weekDaysCustom.includes(brt.dayOfWeek) && todayCandidate > brt.date) {
          return todayCandidate.toISOString();
        }
        for (let i = 1; i <= 7; i++) {
          const futureDate = new Date(Date.UTC(brt.year, brt.month, brt.day + i));
          if (weekDaysCustom.includes(futureDate.getUTCDay())) {
            return brtToUtc(brt.year, brt.month, brt.day + i, hh, mm).toISOString();
          }
        }
      }

      if (todayCandidate > brt.date) return todayCandidate.toISOString();
      return brtToUtc(brt.year, brt.month, brt.day + 1, hh, mm).toISOString();
    }

    case "interval": {
      const intervalMinutes = content.intervalMinutes || 60;
      return new Date(Date.now() + intervalMinutes * 60000).toISOString();
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

    // 1. Fetch scheduled messages to find media files before cascade deletes them
    const { data: messages } = await sb
      .from("group_scheduled_messages")
      .select("msg_type, content")
      .eq("campaign_id", req.params.id);

    // 2. Collect storage paths from media messages
    const mediaTypes = ["image", "video", "audio", "document"];
    const storagePaths: string[] = [];
    if (messages) {
      for (const msg of messages) {
        if (!mediaTypes.includes(msg.msg_type) || !msg.content) continue;
        // Extract path after /chatbot-media/ from the URL
        const match = msg.content.match(/\/chatbot-media\/(.+?)(?:\?|$)/);
        if (match?.[1]) storagePaths.push(decodeURIComponent(match[1]));
      }
    }

    // 3. Remove media files from storage (best-effort)
    if (storagePaths.length > 0) {
      const { error: rmErr } = await sb.storage.from("chatbot-media").remove(storagePaths);
      if (rmErr) console.warn("[groups] Failed to clean media files:", rmErr.message);
      else console.log(`[groups] Cleaned ${storagePaths.length} media file(s) for campaign ${req.params.id}`);
    }

    // 4. Delete campaign (cascade removes scheduled messages)
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
    const { workspaceId, userId, messageType, content, scheduleType, scheduledAt, intervalMinutes } = req.body;
    if (!workspaceId || !userId) return res.status(400).json({ error: "Missing fields" });

    const st = scheduleType || "once";
    const msgData = { schedule_type: st, scheduled_at: scheduledAt || null, content: content || {} };
    const nextRunAt = calculateFirstRunAt(msgData);

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("group_scheduled_messages")
      .insert({
        campaign_id: req.params.id,
        workspace_id: workspaceId,
        user_id: userId,
        message_type: messageType || "text",
        content: content || {},
        schedule_type: st,
        scheduled_at: scheduledAt || null,
        cron_expression: null,
        interval_minutes: intervalMinutes || null,
        is_active: true,
        next_run_at: nextRunAt,
      })
      .select()
      .single();
    if (error) throw error;
    console.log(`[groups-api] Created message ${data.id}: type=${st}, next_run=${nextRunAt}`);
    // Register with in-memory scheduler
    groupScheduler.scheduleMessage({ id: data.id, schedule_type: st, content: data.content, campaign_id: req.params.id, next_run_at: data.next_run_at, is_active: true });
    res.json(data);
  } catch (err: any) {
    console.error("[groups-api] create message error:", err?.message || err?.details || JSON.stringify(err));
    res.status(500).json({ error: err?.message || err?.details || err?.hint || "Unknown error" });
  }
});

router.put("/campaigns/:id/messages/:msgId", async (req: Request, res: Response) => {
  try {
    const { messageType, content, scheduleType, scheduledAt, intervalMinutes } = req.body;
    const update: any = {};
    if (messageType !== undefined) update.message_type = messageType;
    if (content !== undefined) update.content = content;
    if (scheduleType !== undefined) update.schedule_type = scheduleType;
    if (scheduledAt !== undefined) update.scheduled_at = scheduledAt;
    if (intervalMinutes !== undefined) update.interval_minutes = intervalMinutes;

    // Recalculate next_run_at if ANY schedule-related field changed
    if (scheduleType !== undefined || scheduledAt !== undefined || intervalMinutes !== undefined || content !== undefined) {
      const sb2 = getServiceClient();
      const { data: current } = await sb2
        .from("group_scheduled_messages")
        .select("schedule_type, scheduled_at, content")
        .eq("id", req.params.msgId)
        .single();

      const finalScheduleType = scheduleType ?? current?.schedule_type ?? "once";
      const finalScheduledAt = scheduledAt ?? current?.scheduled_at ?? null;
      const finalContent = content ?? current?.content ?? {};

      update.next_run_at = calculateFirstRunAt({ schedule_type: finalScheduleType, scheduled_at: finalScheduledAt, content: finalContent });
      update.cron_expression = null; // No longer used
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
    // Update in-memory scheduler
    groupScheduler.scheduleMessage({ id: data.id, schedule_type: data.schedule_type, content: data.content, campaign_id: req.params.id, next_run_at: data.next_run_at, is_active: data.is_active });
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
    // Remove from in-memory scheduler
    groupScheduler.cancelMessage(req.params.msgId);
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
      .select("is_active, schedule_type, scheduled_at, content")
      .eq("id", req.params.msgId)
      .single();
    if (fErr || !msg) return res.status(404).json({ error: "Message not found" });

    const newActive = !msg.is_active;
    const updateData: any = { is_active: newActive };

    // Recalculate next_run_at when activating
    if (newActive) {
      updateData.next_run_at = calculateFirstRunAt({ schedule_type: msg.schedule_type, scheduled_at: msg.scheduled_at, content: msg.content });
    }

    const { data, error } = await sb
      .from("group_scheduled_messages")
      .update(updateData)
      .eq("id", req.params.msgId)
      .select()
      .single();
    if (error) throw error;
    // Update in-memory scheduler
    if (newActive) {
      groupScheduler.scheduleMessage({ id: data.id, schedule_type: data.schedule_type, content: data.content, campaign_id: req.params.id, next_run_at: data.next_run_at, is_active: true });
    } else {
      groupScheduler.cancelMessage(req.params.msgId);
    }
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
      // ─── Deduplication: skip if already sent for this scheduled_message + group ───
      if (item.scheduled_message_id) {
        const dedupWindow = new Date(Date.now() - 5 * 60000).toISOString();
        const { count: alreadySent } = await sb
          .from("group_message_queue")
          .select("id", { count: "exact", head: true })
          .eq("scheduled_message_id", item.scheduled_message_id)
          .eq("group_jid", item.group_jid)
          .eq("status", "sent")
          .neq("id", item.id)
          .gte("created_at", dedupWindow);

        if ((alreadySent || 0) > 0) {
          await sb.from("group_message_queue")
            .update({ status: "cancelled", error_message: "Dedup: já enviada", completed_at: new Date().toISOString() })
            .eq("id", item.id);
          skipped++;
          continue;
        }
      }

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
        const mentionsEveryOne = content.mentionsEveryOne || content.mentionAll || false;

        if (item.message_type === "text") {
          const r = await fetch(`${baseUrl}/message/sendText/${encoded}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: item.group_jid, text: content.text || content.caption || "", mentionsEveryOne }),
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
              mentionsEveryOne,
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

/* ─── Queue Clear Endpoints ─── */
router.post("/queue/clear", async (req: Request, res: Response) => {
  try {
    const { workspaceId, filter } = req.body;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    let query = sb.from("group_message_queue").delete().eq("workspace_id", workspaceId);

    if (filter === "sent") {
      query = query.eq("status", "sent");
    } else if (filter === "failed") {
      query = query.eq("status", "failed");
    } else if (filter === "sent_failed") {
      query = query.in("status", ["sent", "failed"]);
    } else if (filter === "all") {
      query = query.in("status", ["sent", "failed", "cancelled"]);
    } else {
      return res.status(400).json({ error: "Invalid filter. Use: sent, failed, sent_failed, all" });
    }

    const { error } = await query;
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
      const intervalMinutes = msg.interval_minutes || null;
      const nextRunAt = calculateFirstRunAt({ schedule_type: scheduleType, scheduled_at: scheduledAt, content });

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
          cron_expression: null,
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

/* ─── POST /import-media (multipart/form-data) ─── */
router.post("/import-media", async (req: Request, res: Response) => {
  console.log("[import-media] ▶ Request received", { contentLength: req.headers["content-length"], contentType: req.headers["content-type"]?.substring(0, 60) });
  try {
    // Parse multipart form data manually using the built-in request
    const contentType = req.headers["content-type"] || "";

    let workspaceId: string | undefined;
    let userId: string | undefined;
    let mediaPath: string | undefined;
    let fileBuffer: Buffer | undefined;
    let fileMimeType = "application/octet-stream";

    if (contentType.includes("multipart/form-data")) {
      // Use busboy-style parsing or raw buffer approach
      const boundary = contentType.split("boundary=")[1];
      if (!boundary) return res.status(400).json({ error: "Missing boundary" });

      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });

      // Parse multipart parts
      const parts = parseMultipart(rawBody, boundary);
      for (const part of parts) {
        if (part.name === "workspaceId") workspaceId = part.data.toString("utf-8");
        else if (part.name === "userId") userId = part.data.toString("utf-8");
        else if (part.name === "path") mediaPath = part.data.toString("utf-8");
        else if (part.name === "file") {
          fileBuffer = part.data;
          fileMimeType = part.contentType || "application/octet-stream";
        }
      }
    } else {
      // Fallback: JSON body with dataUri (legacy support)
      const { workspaceId: wId, userId: uId, path: p, dataUri } = req.body;
      workspaceId = wId;
      userId = uId;
      mediaPath = p;

      if (dataUri) {
        const base64Match = (dataUri as string).match(/^data:([^;]+);base64,(.+)$/);
        if (base64Match) {
          fileMimeType = base64Match[1];
          fileBuffer = Buffer.from(base64Match[2], "base64");
        }
      }
    }

    if (!workspaceId || !userId || !mediaPath || !fileBuffer) {
      return res.status(400).json({ error: "Missing workspaceId, userId, path or file" });
    }

    const ext = mediaPath.split('.').pop() || fileMimeType.split("/")[1]?.split("+")[0] || "bin";
    const uniqueName = `${crypto.randomUUID()}.${ext}`;
    const userDir = path.join("/media-files", userId);
    fs.mkdirSync(userDir, { recursive: true });
    const filePath = path.join(userDir, uniqueName);
    fs.writeFileSync(filePath, fileBuffer);

    const apiUrl = process.env.API_URL || "";
    const publicUrl = `${apiUrl}/media/${userId}/${uniqueName}`;
    console.log(`[import-media] Saved ${mediaPath} → ${publicUrl}`);
    res.json({ oldPath: mediaPath, newUrl: publicUrl });
  } catch (err: any) {
    console.error("[import-media] error:", err?.message || JSON.stringify(err));
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── Multipart parser helper ─── */
interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const endBuf = Buffer.from(`--${boundary}--`);

  let pos = 0;
  // Find first boundary
  pos = body.indexOf(boundaryBuf, pos);
  if (pos === -1) return parts;
  pos += boundaryBuf.length;

  while (pos < body.length) {
    // Skip CRLF after boundary
    if (body[pos] === 0x0d && body[pos + 1] === 0x0a) pos += 2;
    else if (body[pos] === 0x0a) pos += 1;

    // Check for end boundary
    if (body.indexOf(endBuf, pos - boundaryBuf.length - 4) !== -1 && body.indexOf(endBuf, pos - boundaryBuf.length - 4) < pos) {
      break;
    }

    // Parse headers
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), pos);
    if (headerEnd === -1) break;
    const headerStr = body.subarray(pos, headerEnd).toString("utf-8");
    pos = headerEnd + 4;

    // Find next boundary
    const nextBoundary = body.indexOf(boundaryBuf, pos);
    if (nextBoundary === -1) break;

    // Data is between current pos and 2 bytes before next boundary (CRLF)
    let dataEnd = nextBoundary - 2; // skip trailing CRLF before boundary
    if (dataEnd < pos) dataEnd = pos;
    const data = body.subarray(pos, dataEnd);
    pos = nextBoundary + boundaryBuf.length;

    // Parse header fields
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch?.[1],
        contentType: ctMatch?.[1]?.trim(),
        data,
      });
    }
  }

  return parts;
}

/* ─── POST /import-remap-media ─── */
router.post("/import-remap-media", async (req: Request, res: Response) => {
  try {
    const { workspaceId, messageIds, mediaUrlMap, urlRemapMap } = req.body;
    const remapEntries = mediaUrlMap || urlRemapMap;
    if (!workspaceId || !messageIds || !remapEntries) {
      return res.status(400).json({ error: "Missing workspaceId, messageIds or mediaUrlMap/urlRemapMap" });
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
      for (const [oldPath, newUrl] of Object.entries(remapEntries)) {
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

/* ─── Scheduler Debug Endpoint ─── */
router.get("/scheduler-debug", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const sb = getServiceClient();
    const now = new Date();

    // BRT = UTC-3
    const brtOffset = -3 * 60 * 60 * 1000;
    const nowBrt = new Date(now.getTime() + brtOffset);
    const todayStartBrt = new Date(nowBrt);
    todayStartBrt.setUTCHours(0, 0, 0, 0);
    const todayEndBrt = new Date(nowBrt);
    todayEndBrt.setUTCHours(23, 59, 59, 999);

    // Convert BRT boundaries back to UTC for query
    const todayStartUtc = new Date(todayStartBrt.getTime() - brtOffset).toISOString();
    const todayEndUtc = new Date(todayEndBrt.getTime() - brtOffset).toISOString();

    // Fetch all active scheduled messages for today (by next_run_at or last_run_at)
    const { data: messages, error: msgErr } = await sb
      .from("group_scheduled_messages")
      .select("id, schedule_type, message_type, content, is_active, next_run_at, last_run_at, campaign_id")
      .eq("is_active", true)
      .order("next_run_at", { ascending: true });

    if (msgErr) return res.status(500).json({ error: msgErr.message });

    // Filter messages relevant to today (next_run_at today OR last_run_at today)
    const todayMessages = (messages || []).filter((m: any) => {
      const nextRun = m.next_run_at ? new Date(m.next_run_at) : null;
      const lastRun = m.last_run_at ? new Date(m.last_run_at) : null;
      const nextRunToday = nextRun && nextRun >= new Date(todayStartUtc) && nextRun <= new Date(todayEndUtc);
      const lastRunToday = lastRun && lastRun >= new Date(todayStartUtc) && lastRun <= new Date(todayEndUtc);
      return nextRunToday || lastRunToday;
    });

    // Get campaign names
    const campaignIds = [...new Set(todayMessages.map((m: any) => m.campaign_id))];
    const campaignMap: Record<string, string> = {};
    if (campaignIds.length > 0) {
      const { data: campaigns } = await sb
        .from("group_campaigns")
        .select("id, name, workspace_id")
        .in("id", campaignIds)
        .eq("workspace_id", workspaceId);
      for (const c of campaigns || []) {
        campaignMap[c.id] = c.name;
      }
    }

    // Get queue items for today
    const msgIds = todayMessages.map((m: any) => m.id);
    let queueMap: Record<string, any[]> = {};
    if (msgIds.length > 0) {
      const { data: queueItems } = await sb
        .from("group_message_queue")
        .select("scheduled_message_id, group_jid, group_name, status, created_at, started_at, completed_at, error_message")
        .in("scheduled_message_id", msgIds)
        .gte("created_at", todayStartUtc)
        .order("created_at", { ascending: true });

      for (const qi of queueItems || []) {
        if (!queueMap[qi.scheduled_message_id]) queueMap[qi.scheduled_message_id] = [];
        queueMap[qi.scheduled_message_id].push(qi);
      }
    }

    // Count unique groups across all campaigns for this workspace
    const { count: groupsCount } = await sb
      .from("group_campaign_groups")
      .select("group_jid", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    // Build response
    const result = todayMessages.map((m: any) => {
      const hasTimer = groupScheduler.hasTimer(m.id);
      const nextRun = m.next_run_at ? new Date(m.next_run_at) : null;
      const queueItems = queueMap[m.id] || [];

      // Detect missed: next_run_at in the past, active, no queue items for this run
      const isPast = nextRun && nextRun < now;
      const hasRecentQueue = queueItems.length > 0;
      const missed = !!(isPast && m.is_active && !hasRecentQueue && !hasTimer);

      // Content preview
      let contentPreview = "";
      let contentData: any = {};
      try {
        const c = typeof m.content === "string" ? JSON.parse(m.content) : m.content;
        contentData = c || {};
        contentPreview = c.text || c.caption || c.fileName || c.audioUrl?.slice(-30) || JSON.stringify(c).slice(0, 80);
      } catch { contentPreview = "—"; }

      // Count target groups for this message's campaign
      const campaignGroups = todayMessages.filter((tm: any) => tm.campaign_id === m.campaign_id);

      return {
        id: m.id,
        schedule_type: m.schedule_type,
        message_type: m.message_type || "text",
        is_active: m.is_active,
        next_run_at: m.next_run_at,
        last_run_at: m.last_run_at,
        has_timer: hasTimer,
        missed,
        campaign_name: campaignMap[m.campaign_id] || "Campanha desconhecida",
        content_preview: contentPreview,
        content: contentData,
        queue_items: queueItems.map((qi: any) => ({
          group_jid: qi.group_jid,
          group_name: qi.group_name,
          status: qi.status,
          created_at: qi.created_at,
          started_at: qi.started_at,
          completed_at: qi.completed_at,
          error_message: qi.error_message,
        })),
      };
    });

    const serverTimeUtc = now.toISOString();
    const serverTimeBrt = new Date(now.getTime() + brtOffset).toISOString().replace("T", " ").slice(0, 19);

    res.json({
      timers_active: groupScheduler.activeCount,
      server_time_utc: serverTimeUtc,
      server_time_brt: serverTimeBrt,
      groups_count: groupsCount || 0,
      messages: result,
    });
  } catch (err: any) {
    console.error("[scheduler-debug] error:", err?.message);
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

/* ─── Exportar helpers para uso no cron ─── */
export { getEvolutionConfig };

export default router;
