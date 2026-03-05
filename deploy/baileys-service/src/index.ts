import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  WAMessageContent,
  WAMessageKey,
} from "@whiskeysockets/baileys";
import pino from "pino";
import * as QRCode from "qrcode";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = parseInt(process.env.PORT || "8084");
const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://backend:3001/api/webhook";
const API_KEY = process.env.API_KEY || "baileys-local-key";
const SESSIONS_DIR = path.resolve("/app/sessions");

const logger = pino({ level: "warn" });

// ─── Session store ───
interface SessionData {
  sock: ReturnType<typeof makeWASocket> | null;
  qr: string | null;
  status: "close" | "connecting" | "open";
}
const sessions = new Map<string, SessionData>();

function ensureSessionDir(name: string) {
  const dir = path.join(SESSIONS_DIR, name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Auth middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.headers["apikey"] as string;
  if (key !== API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}
app.use(authMiddleware);

async function startSession(instanceName: string): Promise<SessionData> {
  const dir = ensureSessionDir(instanceName);
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const session: SessionData = { sock: null, qr: null, status: "connecting" };
  sessions.set(instanceName, session);

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
  });

  session.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      session.qr = await QRCode.toDataURL(qr);
      session.status = "connecting";
      console.log(`[${instanceName}] QR code generated`);
    }
    if (connection === "close") {
      session.status = "close";
      session.qr = null;
      const reason = (lastDisconnect?.error as any)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log(`[${instanceName}] Reconnecting...`);
        setTimeout(() => startSession(instanceName), 3000);
      } else {
        console.log(`[${instanceName}] Logged out`);
        sessions.delete(instanceName);
      }
      // Notify webhook about connection update
      sendWebhook(instanceName, "connection.update", { state: "close", reason });
    }
    if (connection === "open") {
      session.status = "open";
      session.qr = null;
      console.log(`[${instanceName}] Connected!`);
      sendWebhook(instanceName, "connection.update", { state: "open" });
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
    for (const msg of msgs) {
      if (!msg.key.remoteJid) continue;
      // Forward to webhook
      sendWebhook(instanceName, "messages.upsert", {
        key: msg.key,
        pushName: msg.pushName,
        message: msg.message,
        messageTimestamp: msg.messageTimestamp,
      });
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      sendWebhook(instanceName, "messages.update", {
        key: update.key,
        update: update.update,
        status: (update.update as any)?.status,
      });
    }
  });

  return session;
}

function sendWebhook(instance: string, event: string, data: any) {
  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, instance, data }),
  }).catch((err) => console.error(`[${instance}] Webhook error:`, err.message));
}

function getSession(instanceName: string): SessionData | null {
  return sessions.get(instanceName) || null;
}

// ─── Auto-start existing sessions ───
async function autoStart() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    return;
  }
  const dirs = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  for (const name of dirs) {
    console.log(`[auto-start] Restoring session: ${name}`);
    await startSession(name);
  }
}

// ─── Routes: Instance Management ───

app.post("/instance/create", async (req, res) => {
  const instanceName = req.body.instanceName || `sc-${Date.now().toString(36)}`;
  if (sessions.has(instanceName)) {
    return res.json({ instanceName, status: "already_exists" });
  }
  await startSession(instanceName);
  res.json({ instanceName, status: "created" });
});

app.get("/instance/connect/:instance", async (req, res) => {
  const name = req.params.instance;
  let session = getSession(name);
  if (!session) {
    session = await startSession(name);
  }
  // Wait a moment for QR if not ready
  if (!session.qr && session.status === "connecting") {
    await new Promise(r => setTimeout(r, 3000));
  }
  res.json({
    instance: { instanceName: name, state: session.status },
    qrcode: session.qr ? { base64: session.qr } : null,
  });
});

app.post("/instance/connect/:instance", async (req, res) => {
  const name = req.params.instance;
  let session = getSession(name);
  if (!session) {
    session = await startSession(name);
  }
  if (!session.qr && session.status === "connecting") {
    await new Promise(r => setTimeout(r, 3000));
  }
  res.json({
    instance: { instanceName: name, state: session.status },
    qrcode: session.qr ? { base64: session.qr } : null,
  });
});

app.get("/instance/fetchInstances", (req, res) => {
  const list = Array.from(sessions.entries()).map(([name, s]) => ({
    instance: { instanceName: name, state: s.status },
  }));
  res.json(list);
});

app.get("/instance/connectionState/:instance", (req, res) => {
  const s = getSession(req.params.instance);
  res.json({
    instance: { instanceName: req.params.instance, state: s?.status || "close" },
  });
});

app.delete("/instance/delete/:instance", (req, res) => {
  const name = req.params.instance;
  const s = getSession(name);
  if (s?.sock) {
    s.sock.end(undefined);
  }
  sessions.delete(name);
  // Remove session files
  const dir = path.join(SESSIONS_DIR, name);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  res.json({ deleted: true });
});

// ─── Routes: Messaging ───

app.post("/message/sendText/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.status(400).json({ error: "Instance not connected" });
  }
  const { number, text } = req.body;
  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
  try {
    const result = await s.sock.sendMessage(jid, { text });
    res.json({ key: result?.key, status: "sent" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/message/sendMedia/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.status(400).json({ error: "Instance not connected" });
  }
  const { number, mediatype, media, caption, fileName, mimetype } = req.body;
  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
  try {
    let msg: any;
    if (mediatype === "image") {
      msg = { image: { url: media }, caption: caption || "" };
    } else if (mediatype === "video") {
      msg = { video: { url: media }, caption: caption || "" };
    } else if (mediatype === "document") {
      msg = { document: { url: media }, mimetype: mimetype || "application/pdf", fileName: fileName || "document.pdf" };
    } else {
      msg = { document: { url: media }, mimetype: mimetype || "application/octet-stream" };
    }
    const result = await s.sock.sendMessage(jid, msg);
    res.json({ key: result?.key, status: "sent" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/message/sendWhatsAppAudio/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.status(400).json({ error: "Instance not connected" });
  }
  const { number, audio } = req.body;
  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
  try {
    const result = await s.sock.sendMessage(jid, {
      audio: { url: audio },
      mimetype: "audio/mp4",
      ptt: true,
    });
    res.json({ key: result?.key, status: "sent" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/message/sendPresence/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.status(200).json({ ok: true });
  }
  const { number, presence } = req.body;
  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
  try {
    await s.sock.sendPresenceUpdate(presence, jid);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // non-fatal
  }
});

// ─── Routes: Chat ───

app.post("/chat/findMessages/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.json([]);
  }
  // Baileys doesn't have a built-in findMessages like Evolution API
  // Return empty — messages are tracked via webhook + DB
  res.json([]);
});

app.post("/chat/findChats/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.json([]);
  }
  // Baileys doesn't expose a chat list API in the same way
  res.json([]);
});

app.post("/chat/findContacts/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.json([]);
  }
  res.json([]);
});

app.post("/chat/fetchProfilePictureUrl/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.json({ profilePictureUrl: null });
  }
  const { number } = req.body;
  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
  try {
    const url = await s.sock.profilePictureUrl(jid, "image");
    res.json({ profilePictureUrl: url });
  } catch {
    res.json({ profilePictureUrl: null });
  }
});

app.post("/chat/getBase64FromMediaMessage/:instance", async (req, res) => {
  const s = getSession(req.params.instance);
  if (!s?.sock || s.status !== "open") {
    return res.json({ base64: null });
  }
  try {
    const { message } = req.body;
    const mediaMsg = message?.message?.imageMessage || message?.message?.videoMessage || message?.message?.audioMessage || message?.message?.documentMessage;
    if (!mediaMsg) {
      return res.json({ base64: null });
    }
    const buffer = await (await import("@whiskeysockets/baileys")).downloadMediaMessage(
      message as any,
      "buffer",
      {},
      { logger, reuploadRequest: s.sock.updateMediaMessage }
    );
    res.json({ base64: (buffer as Buffer).toString("base64") });
  } catch (err: any) {
    console.error("getBase64 error:", err.message);
    res.json({ base64: null });
  }
});

// ─── Webhook set (compatibility — no-op since we auto-send) ───
app.post("/webhook/set/:instance", (req, res) => {
  res.json({ ok: true, message: "Webhooks are auto-configured in Baileys service" });
});

// ─── Health ───
app.get("/health", (req, res) => res.json({ ok: true, sessions: sessions.size }));

// ─── Start ───
autoStart().then(() => {
  app.listen(PORT, () => {
    console.log(`Baileys service running on port ${PORT}`);
  });
});
