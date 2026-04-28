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

import followupDailyRouter from "./routes/followup-daily";
import { processFollowUpDaily, prepareFollowUpDaily } from "./routes/followup-daily";
import groupsApiRouter from "./routes/groups-api";
import groupsWebhookRouter from "./routes/groups-webhook";
import memberAccessRouter from "./routes/member-access";
import memberPurchaseRouter from "./routes/member-purchase";
import { getAllQueuesStatus, clearQueueHistory } from "./lib/message-queue";
import mediaManagerRouter from "./routes/media-manager";
import { groupScheduler } from "./lib/group-scheduler";
import { baileysRequest } from "./lib/baileys-config";
import syncMetaAdsRouter from "./routes/sync-meta-ads";


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

app.use("/api/followup-daily", followupDailyRouter);
app.use("/api/groups", groupsApiRouter);
app.use("/api/groups/webhook", groupsWebhookRouter);
app.use("/api/member-access", memberAccessRouter);
app.use("/api/member-purchase", memberPurchaseRouter);
app.use("/api/media-manager", mediaManagerRouter);
app.use("/api/sync-meta-ads", syncMetaAdsRouter);

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


// Follow-up PREPARE cron — runs at 00:01 BRT daily
const prepareTriggered = new Set<string>();
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hh = brasiliaTime.getHours().toString().padStart(2, "0");
    const mm = brasiliaTime.getMinutes().toString().padStart(2, "0");
    const currentTime = `${hh}:${mm}`;
    const todayKey = now.toISOString().slice(0, 10);

    if (currentTime === "00:00") prepareTriggered.clear();

    if (currentTime === "00:01" && !prepareTriggered.has(todayKey)) {
      prepareTriggered.add(todayKey);
      console.log(`[cron] 🔄 Running follow-up PREPARE at ${currentTime} BRT`);
      await prepareFollowUpDaily();
    }
  } catch (err: any) {
    console.error("[cron] followup-prepare error:", err.message);
  }
});

// Follow-up SEND cron — checks every minute if it's time to send
const followupTriggeredToday = new Set<string>();
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hh = brasiliaTime.getHours().toString().padStart(2, "0");
    const mm = brasiliaTime.getMinutes().toString().padStart(2, "0");
    const currentTime = `${hh}:${mm}`;
    const todayKey = now.toISOString().slice(0, 10);

    if (currentTime === "00:00") followupTriggeredToday.clear();

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
    const { data: settings } = await sb.from("followup_settings").select("workspace_id, send_at_hour").eq("enabled", true).eq("send_at_hour", currentTime);

    if (settings && settings.length > 0) {
      for (const s of settings) {
        const triggerKey = `${todayKey}:${s.workspace_id}`;
        if (followupTriggeredToday.has(triggerKey)) continue;
        followupTriggeredToday.add(triggerKey);
        console.log(`[cron] ⏰ Triggering follow-up SEND for workspace ${s.workspace_id} at ${currentTime}`);
      }
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

// ─── Group Scheduler: Safety sweep every 5 minutes (catches orphaned timers) ───
cron.schedule("*/5 * * * *", async () => {
  try {
    await groupScheduler.safetySweep();
  } catch (err: any) {
    console.error("[cron] group-scheduler safety sweep error:", err.message);
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


// -- Instance Reset Scheduler (every minute) --
cron.schedule("* * * * *", async () => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
    const { data: configs } = await sb.from("instance_reset_config").select("*").eq("enabled", true);
    if (!configs || configs.length === 0) return;
    const now = new Date();
    for (const cfg of configs) {
      const lastReset = cfg.last_reset_at ? new Date(cfg.last_reset_at) : null;
      const intervalMs = cfg.interval_minutes * 60 * 1000;
      if (lastReset && (now.getTime() - lastReset.getTime()) < intervalMs) continue;
      try {
        const encodedName = encodeURIComponent(cfg.instance_name);
        try {
          await baileysRequest("/instance/restart/" + encodedName, "PUT");
          await sb.from("instance_reset_config").update({ last_reset_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", cfg.id);
          console.log("[instance-reset] Restarted " + cfg.instance_name + " (interval: " + cfg.interval_minutes + "min)");
        } catch (e: any) {
          console.error("[instance-reset] Failed to restart " + cfg.instance_name + ": " + e.message);
        }
      } catch (e) {
        console.error("[instance-reset] Error restarting " + cfg.instance_name + ":", e.message);
      }
    }
  } catch (err) {
    console.error("[cron] instance-reset error:", err.message);
  }
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);

  // ─── Initialize in-memory group scheduler (replaces old cron + self-heal) ───
  try {
    await groupScheduler.loadAll();
    console.log(`[scheduler] 🚀 Scheduler initialized with ${groupScheduler.activeCount} active timer(s)`);
  } catch (err: any) {
    console.error("[scheduler] Initialization error:", err.message);
  }

  // ─── Stale processing recovery: cancel any items stuck as "processing" on startup ───
  try {
    const { createClient: _createClient } = await import("@supabase/supabase-js");
    const sb = _createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
    const { data: stale, error: staleErr } = await sb
      .from("group_message_queue")
      .update({ status: "cancelled", error_message: "Envio interrompido: serviço reiniciado" })
      .eq("status", "processing")
      .select("id");
    if (!staleErr && stale && stale.length > 0) {
      console.log(`[queue-recovery] Startup: cancelled ${stale.length} stale processing item(s)`);
    }
  } catch (recErr: any) {
    console.error("[queue-recovery] Startup recovery error:", recErr.message);
  }

  // Group monitoring agora depende exclusivamente do sync de Smart Links
  // (rota POST /api/groups/smart-links/sync-all, agendada externamente).
});

// ─── Periodic stale processing recovery (every 15 min) ───
setInterval(async () => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stale } = await sb
      .from("group_message_queue")
      .update({ status: "cancelled", error_message: "Envio interrompido: tempo máximo excedido (30min)" })
      .eq("status", "processing")
      .lt("started_at", cutoff)
      .select("id");
    if (stale && stale.length > 0) {
      console.log(`[queue-recovery] Periodic: cancelled ${stale.length} stale processing item(s)`);
    }
  } catch {}
}, 15 * 60 * 1000);
