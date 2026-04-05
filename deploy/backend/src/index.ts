import express from "express";
import cors from "cors";
import cron from "node-cron";

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

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
