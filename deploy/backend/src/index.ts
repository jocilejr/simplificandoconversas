import express from "express";
import cors from "cors";
import cron from "node-cron";

import webhookRouter from "./routes/webhook";
import executeFlowRouter from "./routes/execute-flow";
import evolutionProxyRouter from "./routes/evolution-proxy";
import linkRedirectRouter from "./routes/link-redirect";
import { processTimeouts } from "./routes/check-timeouts";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Routes (mapped from /functions/v1/X via Nginx → /api/X)
app.use("/api/evolution-webhook", webhookRouter);
app.use("/api/execute-flow", executeFlowRouter);
app.use("/api/evolution-proxy", evolutionProxyRouter);
app.use("/api/link-redirect", linkRedirectRouter);
app.use("/api/webhook", webhookRouter); // Baileys sends here directly

// Health
app.get("/health", (_, res) => res.json({ ok: true }));

// Check timeouts every 30 seconds
cron.schedule("*/30 * * * * *", async () => {
  try {
    await processTimeouts();
  } catch (err: any) {
    console.error("[cron] check-timeouts error:", err.message);
  }
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
