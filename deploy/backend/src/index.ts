import express from "express";
import cors from "cors";
import cron from "node-cron";
import fs from "fs/promises";
import path from "path";

import webhookRouter from "./routes/webhook";
import executeFlowRouter from "./routes/execute-flow";
import whatsappProxyRouter from "./routes/whatsapp-proxy";
import linkRedirectRouter from "./routes/link-redirect";
import healthDbRouter from "./routes/health-db";
import { processTimeouts } from "./routes/check-timeouts";

import extensionApiRouter from "./routes/extension-api";
import platformApiRouter from "./routes/platform-api";
import externalWebhookRouter from "./routes/external-webhook";
import emailRouter from "./routes/email";
import analyzeCsvRouter from "./routes/analyze-csv-contacts";
import paymentRouter from "./routes/payment";
import paymentOpenpixRouter from "./routes/payment-openpix";
import resolveUserRouter from "./routes/resolve-user";
import yampiWebhookRouter from "./routes/yampi-webhook";
import manualPaymentRouter from "./routes/manual-payment-webhook";
import autoRecoveryRouter from "./routes/auto-recovery";
import followupDailyRouter from "./routes/followup-daily";
import { processFollowUpDaily } from "./routes/followup-daily";
import groupsApiRouter, { computeNextRunAfterExecution } from "./routes/groups-api";
import groupsWebhookRouter from "./routes/groups-webhook";
import memberAccessRouter from "./routes/member-access";
import memberPurchaseRouter from "./routes/member-purchase";
import { getAllQueuesStatus, clearQueueHistory } from "./lib/message-queue";
import mediaManagerRouter from "./routes/media-manager";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Routes (mapped from /functions/v1/X via Nginx → /api/X)
app.use("/api/whatsapp-proxy", whatsappProxyRouter);
app.use("/api/execute-flow", executeFlowRouter);
app.use("/api/link-redirect", linkRedirectRouter);
app.use("/api/webhook", webhookRouter);
app.use("/api/ext", extensionApiRouter);
app.use("/api/platform", platformApiRouter);
app.use("/api/external-messaging-webhook", externalWebhookRouter);
app.use("/api/email", emailRouter);
app.use("/api/analyze-csv-contacts", analyzeCsvRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/payment-openpix", paymentOpenpixRouter);
app.use("/api/resolve-user-by-email", resolveUserRouter);
app.use("/api/yampi-webhook", yampiWebhookRouter);
app.use("/api/manual-payment", manualPaymentRouter);
app.use("/api/auto-recovery", autoRecoveryRouter);
app.use("/api/followup-daily", followupDailyRouter);
app.use("/api/groups", groupsApiRouter);
app.use("/api/groups/webhook", groupsWebhookRouter);
app.use("/api/member-access", memberAccessRouter);
app.use("/api/member-purchase", memberPurchaseRouter);
app.use("/api/media-manager", mediaManagerRouter);

// Queue status (no auth — internal)
app.get("/api/queue-status", (_, res) => res.json(getAllQueuesStatus()));

// Clear queue history
app.post("/api/queue-clear-history", (req, res) => {
  const { instanceName } = req.body || {};
  if (!instanceName) return res.status(400).json({ error: "instanceName required" });
  clearQueueHistory(instanceName);
  res.json({ ok: true });
});

// Health
app.use("/api/health", healthDbRouter);
app.get("/health", (_, res) => res.json({ ok: true }));

// Check timeouts every 30 seconds
cron.schedule("*/30 * * * * *", async () => {
  try {
    await processTimeouts();
  } catch (err: any) {
    console.error("[cron] check-timeouts error:", err.message);
  }
});

// Light sync disabled — use manual "Sincronizar" button per instance instead.

// Auto-recovery cron DISABLED — system is event-driven.
// Use POST /api/auto-recovery/process for manual retries.

// Follow-up daily cron — checks every minute if it's time to send
const followupTriggeredToday = new Set<string>();
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentHour = brasiliaTime.getHours().toString().padStart(2, "0");
    const currentMinute = brasiliaTime.getMinutes().toString().padStart(2, "0");
    const currentTime = `${currentHour}:${currentMinute}`;
    const todayKey = now.toISOString().slice(0, 10);

    // Reset tracking at midnight
    if (currentTime === "00:00") {
      followupTriggeredToday.clear();
    }

    // Check if any workspace needs processing right now
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    );

    const { data: settings } = await sb
      .from("followup_settings")
      .select("workspace_id, send_at_hour")
      .eq("enabled", true)
      .eq("send_at_hour", currentTime);

    if (settings && settings.length > 0) {
      for (const s of settings) {
        const triggerKey = `${todayKey}:${s.workspace_id}`;
        if (followupTriggeredToday.has(triggerKey)) continue;
        followupTriggeredToday.add(triggerKey);
        console.log(`[cron] ⏰ Triggering follow-up daily for workspace ${s.workspace_id} at ${currentTime}`);
      }
      // Process all enabled workspaces that match
      await processFollowUpDaily();
    }
  } catch (err: any) {
    console.error("[cron] followup-daily error:", err.message);
  }
});

// Process email queue every 30 seconds
cron.schedule("*/30 * * * * *", async () => {
  try {
    const resp = await fetch(`http://localhost:${PORT}/api/email/process-queue`, { method: "POST" });
    if (!resp.ok) console.error("[cron] email-queue error:", await resp.text());
  } catch (err: any) {
    console.error("[cron] email-queue error:", err.message);
  }
});

// Cleanup expired boleto PDFs daily at 3AM
cron.schedule("0 3 * * *", async () => {
  try {
    console.log("[cron] Starting boleto cleanup...");
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Find pending boletos older than 30 days
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expired } = await supabase
      .from("transactions")
      .select("id, metadata, user_id")
      .eq("type", "boleto")
      .eq("status", "pendente")
      .lt("created_at", cutoff);

    if (!expired || expired.length === 0) {
      console.log("[cron] No expired boletos to clean.");
      return;
    }

    let deleted = 0;
    for (const tx of expired) {
      const meta = tx.metadata as any;
      const boletoFile = meta?.boleto_file as string | undefined;
      if (boletoFile) {
        // Convert /media/userId/boletos/xxx.pdf → /media-files/userId/boletos/xxx.pdf
        const fsPath = boletoFile.replace("/media/", "/media-files/");
        try {
          await fs.unlink(fsPath);
          deleted++;
        } catch {}

        // Clear boleto_file from metadata
        const newMeta = { ...meta };
        delete newMeta.boleto_file;
        await supabase
          .from("transactions")
          .update({ metadata: newMeta })
          .eq("id", tx.id);
      }
    }
    console.log(`[cron] Boleto cleanup done: ${deleted} files deleted from ${expired.length} expired transactions.`);
  } catch (err: any) {
    console.error("[cron] boleto-cleanup error:", err.message);
  }
});

// ─── Group Scheduler Cron (1/min): enqueue scheduled messages ───
cron.schedule("* * * * *", async () => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const now = new Date().toISOString();
    const { data: dueMessages, error } = await sb
      .from("group_scheduled_messages")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", now);

    if (error) {
      console.error("[cron] group-scheduler query error:", error.message);
      return;
    }
    if (!dueMessages || dueMessages.length === 0) return;

    // ─── Flood protection: max 5 messages per cycle ───
    if (dueMessages.length > 5) {
      console.warn(`[cron] ⚠️ Group scheduler: ${dueMessages.length} messages due — processing max 5 per cycle to prevent flood`);
      dueMessages.splice(5);
    }

    console.log(`[cron] 📅 Group scheduler: ${dueMessages.length} message(s) due`);

    for (const msg of dueMessages) {
      // Fetch campaign separately (avoids PostgREST !inner join issues)
      const { data: campaign, error: campErr } = await sb
        .from("group_campaigns")
        .select("workspace_id, user_id, instance_name, group_jids, is_active")
        .eq("id", msg.campaign_id)
        .single();

      if (campErr || !campaign || !campaign.is_active) {
        if (campErr) console.error(`[cron] group-scheduler campaign fetch error for ${msg.id}:`, campErr.message);
        continue;
      }

      const batch = `auto-${Date.now()}-${msg.id.slice(0, 8)}`;
      const queueItems: any[] = [];

      for (const jid of (campaign.group_jids || [])) {
        // ─── Deduplication: skip if already queued recently ───
        const { count: existing } = await sb
          .from("group_message_queue")
          .select("id", { count: "exact", head: true })
          .eq("scheduled_message_id", msg.id)
          .eq("group_jid", jid)
          .in("status", ["pending", "processing", "sent"])
          .gte("created_at", new Date(Date.now() - 5 * 60000).toISOString());

        if ((existing || 0) > 0) {
          console.log(`[cron] ⏭ Dedup: msg ${msg.id} → ${jid} already queued`);
          continue;
        }

        const { data: sg } = await sb
          .from("group_selected")
          .select("group_name")
          .eq("workspace_id", campaign.workspace_id)
          .eq("group_jid", jid)
          .maybeSingle();

        queueItems.push({
          workspace_id: campaign.workspace_id,
          user_id: campaign.user_id,
          campaign_id: msg.campaign_id,
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

      if (queueItems.length > 0) {
        const { error: insertErr } = await sb.from("group_message_queue").insert(queueItems);
        if (insertErr) {
          console.error("[cron] group-scheduler insert error:", insertErr.message);
          continue;
        }
        console.log(`[cron] ✅ Enqueued ${queueItems.length} items for msg ${msg.id} (batch: ${batch})`);
      }

      // Update last_run_at and compute next_run_at
      const nextRun = computeNextRunAfterExecution(msg.schedule_type, msg.scheduled_at, msg.cron_expression, msg.interval_minutes);
      const updateData: any = { last_run_at: now };
      if (nextRun) {
        updateData.next_run_at = nextRun;
      } else {
        // For 'once' or expired: deactivate
        updateData.is_active = false;
        updateData.next_run_at = null;
      }

      await sb.from("group_scheduled_messages").update(updateData).eq("id", msg.id);
    }
  } catch (err: any) {
    console.error("[cron] group-scheduler error:", err.message);
  }
});

// ─── Group Queue Processor Cron (30s): process pending with rate limiting ───
cron.schedule("*/30 * * * * *", async () => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Get all workspaces that have pending items
    const { data: workspaces } = await sb
      .from("group_message_queue")
      .select("workspace_id")
      .eq("status", "pending")
      .limit(100);

    if (!workspaces || workspaces.length === 0) return;

    const uniqueWs = [...new Set(workspaces.map((w: any) => w.workspace_id))];

    for (const wsId of uniqueWs) {
      try {
        const resp = await fetch(`http://localhost:${PORT}/api/groups/queue/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: wsId }),
        });
        if (!resp.ok) {
          console.error(`[cron] group-queue-processor error for ws ${wsId}:`, await resp.text());
        } else {
          const result = await resp.json() as { sent?: number; failed?: number; skipped?: number };
          if ((result.sent || 0) > 0 || (result.failed || 0) > 0) {
            console.log(`[cron] 📨 Group queue processed ws ${wsId}: sent=${result.sent || 0}, failed=${result.failed || 0}, skipped=${result.skipped || 0}`);
          }
        }
      } catch (e: any) {
        console.error(`[cron] group-queue-processor fetch error:`, e.message);
      }
    }
  } catch (err: any) {
    console.error("[cron] group-queue-processor error:", err.message);
  }
});

// ─── Smart Link Sync Cron (5min): sync member_count and invite_url ───
cron.schedule("*/15 * * * *", async () => {
  try {
    const resp = await fetch(`http://localhost:${PORT}/api/groups/smart-links/sync-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) {
      console.error("[cron] smart-link-sync error:", await resp.text());
    } else {
      const result = await resp.json() as any;
      const count = result?.results?.length || 0;
      if (count > 0) {
        console.log(`[cron] 🔗 Smart link sync: ${count} link(s) processed`);
      }
    }
  } catch (err: any) {
    console.error("[cron] smart-link-sync error:", err.message);
  }
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
