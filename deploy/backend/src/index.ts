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
import { lightSync } from "./routes/light-sync";
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
import { getAllQueuesStatus, clearQueueHistory } from "./lib/message-queue";

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

// Light sync every 5 minutes — catches undecrypted/pending chats
cron.schedule("*/5 * * * *", async () => {
  try {
    await lightSync();
  } catch (err: any) {
    console.error("[cron] light-sync error:", err.message);
  }
});

// Auto-recovery cron DISABLED — system is event-driven.
// Use POST /api/auto-recovery/process for manual retries.

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

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
