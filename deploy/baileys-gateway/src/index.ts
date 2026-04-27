import express from "express";
import { ensureSchema } from "./db";
import { bootstrapInstances } from "./instance-manager";
import instanceRouter from "./routes/instance";
import messageRouter from "./routes/message";
import chatRouter from "./routes/chat";
import groupRouter from "./routes/group";

const PORT = Number(process.env.PORT || 8080);
const API_KEY = process.env.BAILEYS_API_KEY || "";

const app = express();
app.use(express.json({ limit: "50mb" }));

// API key middleware (header `apikey` para compat com backend antigo)
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const provided = String(req.header("apikey") || "");
  if (!API_KEY || provided !== API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "baileys-gateway" }));

app.use("/instance", instanceRouter);
app.use("/message", messageRouter);
app.use("/chat", chatRouter);
app.use("/group", groupRouter);

(async () => {
  await ensureSchema();
  app.listen(PORT, () => {
    console.log(`[baileys-gateway] listening on :${PORT}`);
    bootstrapInstances().catch((e) =>
      console.warn(`[bootstrap] error: ${e.message}`),
    );
  });
})();
