import express from "express";
import { ensureSchema } from "./db";
import { bootstrapExistingInstances } from "./instance-manager";
import instanceRoutes from "./routes/instance";
import messageRoutes from "./routes/message";
import groupRoutes from "./routes/group";
import chatRoutes from "./routes/chat";

const PORT = Number(process.env.PORT || 8080);

const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/", (_req, res) =>
  res.json({ ok: true, name: "baileys-gateway", version: "1.0.0" })
);
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/instance", instanceRoutes);
app.use("/message", messageRoutes);
app.use("/group", groupRoutes);
app.use("/chat", chatRoutes);

async function main() {
  try {
    await ensureSchema();
    console.log("[baileys-gateway] schema ready");
  } catch (err: any) {
    console.error("[baileys-gateway] schema setup failed:", err?.message);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[baileys-gateway] listening on :${PORT}`);
  });

  // Restore previously-paired sessions in background (don't block boot)
  bootstrapExistingInstances().catch((err) =>
    console.error("[baileys-gateway] bootstrap error:", err?.message)
  );
}

main();

process.on("unhandledRejection", (err: any) =>
  console.error("[baileys-gateway] unhandledRejection:", err?.message || err)
);
process.on("uncaughtException", (err: any) =>
  console.error("[baileys-gateway] uncaughtException:", err?.message || err)
);
