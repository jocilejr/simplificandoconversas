import { Router } from "express";
import { getInstance, getOrCreate } from "../instance-manager";
import { requireApiKey, toJid, toGroupJid } from "../lib/http";

const router = Router();
router.use(requireApiKey);

async function getSock(name: string) {
  let runtime = getInstance(name);
  if (!runtime || !runtime.sock) {
    runtime = await getOrCreate(name);
  }
  if (!runtime.sock) throw new Error(`Instance ${name} has no active socket`);
  if (runtime.state !== "open") throw new Error(`Instance ${name} not connected`);
  return runtime.sock;
}

function destFor(input: string): string {
  // Group JIDs end with @g.us; everything else is treated as personal chat.
  if (input?.endsWith?.("@g.us")) return input;
  if (input?.includes?.("@")) return input;
  return toJid(input);
}

/** POST /message/sendText/:instance  body: { number, text, delay? } */
router.post("/sendText/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { number, text } = req.body || {};
    const jid = destFor(number);
    const sent = await sock.sendMessage(jid, { text: String(text ?? "") });
    res.json({
      key: sent?.key,
      status: "PENDING",
      message: { conversation: text },
      messageTimestamp: Math.floor(Date.now() / 1000),
    });
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "send failed" });
  }
});

/** POST /message/sendMedia/:instance  body: { number, mediatype, media, caption?, fileName?, mimetype? } */
router.post("/sendMedia/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { number, mediatype, media, caption, fileName, mimetype } = req.body || {};
    const jid = destFor(number);

    // `media` may be a URL or base64 string
    const isUrl = typeof media === "string" && /^https?:\/\//i.test(media);
    const buf = isUrl ? { url: media as string } : Buffer.from(String(media || ""), "base64");

    let payload: any;
    if (mediatype === "image") payload = { image: buf, caption: caption || undefined };
    else if (mediatype === "video") payload = { video: buf, caption: caption || undefined };
    else if (mediatype === "document")
      payload = {
        document: buf,
        fileName: fileName || "file",
        mimetype: mimetype || "application/octet-stream",
        caption: caption || undefined,
      };
    else payload = { document: buf, fileName: fileName || "file", mimetype: mimetype || "application/octet-stream" };

    const sent = await sock.sendMessage(jid, payload);
    res.json({
      key: sent?.key,
      status: "PENDING",
      messageTimestamp: Math.floor(Date.now() / 1000),
    });
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "send failed" });
  }
});

/** POST /message/sendWhatsAppAudio/:instance  body: { number, audio } */
router.post("/sendWhatsAppAudio/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { number, audio } = req.body || {};
    const jid = destFor(number);
    const isUrl = typeof audio === "string" && /^https?:\/\//i.test(audio);
    const buf = isUrl ? { url: audio as string } : Buffer.from(String(audio || ""), "base64");
    const sent = await sock.sendMessage(jid, {
      audio: buf,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
    });
    res.json({
      key: sent?.key,
      status: "PENDING",
      messageTimestamp: Math.floor(Date.now() / 1000),
    });
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "send failed" });
  }
});

/** POST /message/sendPresence/:instance  body: { number, presence } */
router.post("/sendPresence/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { number, presence } = req.body || {};
    const jid = destFor(number);
    // Baileys presence values: "available" | "composing" | "recording" | "paused" | "unavailable"
    const map: Record<string, any> = {
      composing: "composing",
      recording: "recording",
      paused: "paused",
      available: "available",
      unavailable: "unavailable",
    };
    const p = map[presence] || presence || "available";
    await sock.sendPresenceUpdate(p, jid);
    res.json({ presence: p, jid });
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "presence failed" });
  }
});

export default router;
