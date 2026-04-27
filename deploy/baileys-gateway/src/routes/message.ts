import { Router } from "express";
import { getInstance } from "../instance-manager";

const router = Router();

function jidFromNumber(num: string): string {
  const digits = String(num).replace(/\D/g, "");
  if (digits.includes("@")) return num;
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
  const { number, text, delay } = req.body || {};
  if (!number || !text) return res.status(400).json({ error: "number and text required" });
  if (delay) await new Promise((r) => setTimeout(r, Math.min(Number(delay), 15000)));
  const r = await sock.sendMessage(jidFromNumber(number), { text: String(text) });
  res.json({ key: r?.key, status: "SUCCESS" });
});

router.post("/sendMedia/:name", async (req, res) => {
  const sock = await ensureSock(req, res);
  if (!sock) return;
  const { number, mediatype, media, caption, fileName, mimetype } = req.body || {};
  if (!number || !media) return res.status(400).json({ error: "number and media required" });
  const buffer = Buffer.from(String(media), "base64");
  const jid = jidFromNumber(number);
  let payload: any;
  switch ((mediatype || "image").toLowerCase()) {
    case "image":
      payload = { image: buffer, caption: caption || undefined, mimetype: mimetype || "image/jpeg" };
      break;
    case "video":
      payload = { video: buffer, caption: caption || undefined, mimetype: mimetype || "video/mp4" };
      break;
    case "audio":
      payload = { audio: buffer, mimetype: mimetype || "audio/ogg; codecs=opus", ptt: true };
      break;
    case "document":
    default:
      payload = {
        document: buffer,
        mimetype: mimetype || "application/pdf",
        fileName: fileName || "document.pdf",
        caption: caption || undefined,
      };
      break;
  }
  const r = await sock.sendMessage(jid, payload);
  res.json({ key: r?.key, status: "SUCCESS" });
});

// Compat com chamadas antigas /message/sendMediaPDF/:name
router.post("/sendMediaPDF/:name", async (req, res) => {
  req.body = { ...req.body, mediatype: "document", mimetype: "application/pdf" };
  // @ts-ignore
  return router.handle({ ...req, url: `/sendMedia/${req.params.name}`, method: "POST" }, res, () => {});
});

export default router;
