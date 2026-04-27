import { Router } from "express";
import { getInstance } from "../instance-manager";

const router = Router();

function jidFromNumber(num: string): string {
  const s = String(num).trim();
  if (s.includes("@")) return s;
  const digits = s.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

async function ensureSock(req: any, res: any) {
  const inst = getInstance(req.params.name);
  if (!inst?.sock || inst.status !== "open") {
    res.status(409).json({ error: "instance not connected" });
    return null;
  }
  return inst.sock;
}

router.post("/sendText/:name", async (req, res) => {
  const sock = await ensureSock(req, res);
  if (!sock) return;
  const { number, text, delay, mentionsEveryOne, forceLinkPreview } = req.body || {};
  if (!number || !text) return res.status(400).json({ error: "number and text required" });
  if (delay) await new Promise((r) => setTimeout(r, Math.min(Number(delay), 15000)));
  try {
    const jid = jidFromNumber(number);
    let mentionList: string[] = [];
    if (mentionsEveryOne && jid.endsWith("@g.us")) {
      try {
        const meta = await sock.groupMetadata(jid);
        mentionList = meta.participants.map((p) => p.id);
      } catch {}
    }
    const payload: any = { text: String(text) };
    if (mentionList.length > 0) payload.mentions = mentionList;

    // When forceLinkPreview=true: leave linkPreview undefined so Baileys
    // auto-generates high-quality preview via waUploadToServer (large format).
    // When false: set null to suppress the auto-generated preview.
    if (!forceLinkPreview) {
      payload.linkPreview = null;
    }

    const r = await sock.sendMessage(jid, payload);
    res.json({ key: r?.key, status: "SUCCESS" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/sendMedia/:name", async (req, res) => {
  const sock = await ensureSock(req, res);
  if (!sock) return;
  const { number, mediatype, media, caption, fileName, mimetype } = req.body || {};
  if (!number || !media) return res.status(400).json({ error: "number and media required" });
  const isUrl = typeof media === "string" && /^https?:\/\//i.test(media);
  const mediaContent = isUrl ? { url: media } : Buffer.from(String(media), "base64");
  const jid = jidFromNumber(number);
  let payload: any;
  switch ((mediatype || "image").toLowerCase()) {
    case "image":
      payload = { image: mediaContent as any, caption: caption || undefined, mimetype: mimetype || "image/jpeg" };
      break;
    case "video":
      payload = { video: mediaContent as any, caption: caption || undefined, mimetype: mimetype || "video/mp4" };
      break;
    case "audio":
      payload = { audio: mediaContent as any, mimetype: mimetype || "audio/ogg; codecs=opus", ptt: true };
      break;
    case "document":
    default:
      payload = {
        document: mediaContent as any,
        mimetype: mimetype || "application/pdf",
        fileName: fileName || "document.pdf",
        caption: caption || undefined,
      };
      break;
  }
  try {
    const r = await sock.sendMessage(jid, payload);
    res.json({ key: r?.key, status: "SUCCESS" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/sendMediaPDF/:name", async (req, res) => {
  req.body = { ...req.body, mediatype: "document", mimetype: "application/pdf" };
  // @ts-ignore
  return router.handle({ ...req, url: `/sendMedia/${req.params.name}`, method: "POST" }, res, () => {});
});

router.post("/sendWhatsAppAudio/:name", async (req, res) => {
  const sock = await ensureSock(req, res);
  if (!sock) return;
  const { number, audio } = req.body || {};
  if (!number || !audio) return res.status(400).json({ error: "number and audio required" });
  const jid = jidFromNumber(number);
  try {
    const audioContent = /^https?:\/\//i.test(String(audio)) ? { url: audio } : Buffer.from(String(audio), "base64");
    const r = await sock.sendMessage(jid, { audio: audioContent as any, mimetype: "audio/ogg; codecs=opus", ptt: true });
    res.json({ key: r?.key, status: "SUCCESS" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/sendPresence/:name", async (req, res) => {
  const sock = await ensureSock(req, res);
  if (!sock) return;
  const { number, presence } = req.body || {};
  if (!number) return res.status(400).json({ error: "number required" });
  const jid = jidFromNumber(number);
  const presenceType = presence === "paused" ? "paused" : "composing";
  try {
    await sock.sendPresenceUpdate(presenceType as any, jid);
    res.json({ status: "SUCCESS" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
