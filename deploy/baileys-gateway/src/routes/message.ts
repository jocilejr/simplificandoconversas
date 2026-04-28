import { Router } from "express";
import { getInstance, startInstance } from "../instance-manager";
import { pool } from "../db";
import { extractUrlFromText } from "@whiskeysockets/baileys";

const router = Router();

function jidFromNumber(num: string): string {
  const s = String(num).trim();
  if (s.includes("@")) return s;
  const digits = s.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

async function hasAuthState(name: string): Promise<boolean> {
  const r = await pool.query(
    "SELECT 1 FROM public.baileys_auth_state WHERE instance_name = $1 AND creds IS NOT NULL LIMIT 1",
    [name],
  );
  return r.rows.length > 0;
}

async function resolveJid(sock: any, number: string): Promise<string> {
  const s = String(number).trim();
  if (s.includes("@")) return s;
  const digits = s.replace(/\D/g, "");
  try {
    const results = await sock.onWhatsApp(digits);
    if (results && results.length > 0 && results[0].exists) return results[0].jid;
    throw new Error(`{"exists":false,"number":"${digits}"}`);
  } catch (e: any) {
    if (e.message.includes('"exists":false')) throw e;
    return `${digits}@s.whatsapp.net`;
  }
}

async function ensureSock(req: any, res: any) {
  const name = req.params.name;
  let inst = getInstance(name);

  if (!inst || inst.status === "close") {
    const hasCreds = await hasAuthState(name);
    if (!hasCreds) {
      res.status(409).json({ error: "instance not connected" });
      return null;
    }
    try {
      inst = await startInstance(name);
    } catch {
      res.status(409).json({ error: "instance not connected" });
      return null;
    }
    const deadline = Date.now() + 8000;
    while (inst.status !== "open" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  if (!inst.sock || inst.status !== "open") {
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
    const jid = await resolveJid(sock, number);
    let mentionList: string[] = [];
    if (mentionsEveryOne && jid.endsWith("@g.us")) {
      try {
        const meta = await sock.groupMetadata(jid);
        mentionList = meta.participants.map((p) => p.id);
      } catch {}
    }
    const payload: any = { text: String(text) };
    if (mentionList.length > 0) payload.mentions = mentionList;

    if (forceLinkPreview) {
      const detectedUrl = extractUrlFromText(String(text));
      console.log(`[sendText] forceLinkPreview=true, detectedUrl=${detectedUrl}`);
    } else {
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
  const jid = await resolveJid(sock, number);
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
  const jid = await resolveJid(sock, number);
  try {
    const audioContent = /^https?:\/\//i.test(String(audio)) ? { url: audio } : Buffer.from(String(audio), "base64");
    const r = await sock.sendMessage(jid, { audio: audioContent as any, mimetype: "audio/ogg; codecs=opus", ptt: true });
    res.json({ key: r?.key, status: "SUCCESS" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


router.post("/sendContact/:name", async (req, res) => {
  const sock = await ensureSock(req, res);
  if (!sock) return;
  const { number, contact, mentionsEveryOne } = req.body || {};
  if (!number || !contact) return res.status(400).json({ error: "number and contact required" });
  const jid = number.includes("@") ? number : await (async () => {
    try { return await resolveJid(sock, number); } catch { return `${String(number).replace(/\D/g,"")}@g.us`; }
  })();
  const contactList: any[] = Array.isArray(contact) ? contact : [contact];
  const vcards = contactList.map((c: any) => {
    const phone = String(c.phoneNumber || c.wuid || "").replace(/\D/g, "");
    const name = c.fullName || c.name || c.contactName || phone;
    let vcard = `BEGIN:VCARD
VERSION:3.0
FN:${name}`;
    if (c.organization) vcard += `
ORG:${c.organization}`;
    if (c.email) vcard += `
EMAIL:${c.email}`;
    if (phone) vcard += `
TEL;type=CELL;type=VOICE;waid=${phone}:+${phone}`;
    vcard += `
END:VCARD`;
    return { vcard };
  });
  let mentionList: string[] = [];
  if (mentionsEveryOne && jid.endsWith("@g.us")) {
    try { const meta = await sock.groupMetadata(jid); mentionList = meta.participants.map((p: any) => p.id); } catch {}
  }
  try {
    const displayName = contactList.length === 1
      ? (contactList[0].fullName || contactList[0].name || contactList[0].contactName || "")
      : `${contactList.length} contatos`;
    const payload: any = { contacts: { displayName, contacts: vcards } };
    if (mentionList.length > 0) payload.mentions = mentionList;
    const r = await sock.sendMessage(jid, payload);
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
  const jid = jidFromNumber(number); // presence: skip WA check, fire-and-forget
  const presenceType = presence === "paused" ? "paused" : "composing";
  try {
    await sock.sendPresenceUpdate(presenceType as any, jid);
    res.json({ status: "SUCCESS" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
