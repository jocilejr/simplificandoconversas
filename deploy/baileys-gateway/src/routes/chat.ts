import { Router } from "express";
import { downloadMedia, getInstance } from "../instance-manager";

const router = Router();

function jidFromNumber(num: string): string {
  const digits = String(num).replace(/\D/g, "");
  if (digits.includes("@")) return num;
  return `${digits}@s.whatsapp.net`;
}

router.post("/whatsappNumbers/:name", async (req, res) => {
  const inst = getInstance(req.params.name);
  if (!inst?.sock) return res.status(409).json({ error: "instance not connected" });
  const numbers: string[] = req.body?.numbers || [];
  const out: any[] = [];
  for (const n of numbers) {
    try {
      const digits = String(n).replace(/\D/g, "");
      const r = await inst.sock.onWhatsApp(digits);
      if (r && r.length > 0 && r[0].exists) {
        out.push({ exists: true, jid: r[0].jid, number: digits });
      } else {
        out.push({ exists: false, jid: null, number: digits });
      }
    } catch {
      out.push({ exists: false, jid: null, number: n });
    }
  }
  res.json(out);
});

router.post("/fetchProfilePictureUrl/:name", async (req, res) => {
  const inst = getInstance(req.params.name);
  if (!inst?.sock) return res.status(409).json({ error: "instance not connected" });
  const { number } = req.body || {};
  if (!number) return res.status(400).json({ error: "number required" });
  try {
    const url = await inst.sock.profilePictureUrl(jidFromNumber(number), "image");
    res.json({ profilePictureUrl: url });
  } catch {
    res.json({ profilePictureUrl: null });
  }
});

router.post("/getBase64FromMediaMessage/:name", async (req, res) => {
  try {
    const buffer = await downloadMedia(req.params.name, req.body?.message);
    res.json({ base64: buffer.toString("base64") });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/findChats/:name", async (_req, res) => {
  // Sem store em memória persistente; backend só usa para inventário inicial.
  res.json([]);
});

router.post("/findContacts/:name", async (_req, res) => {
  res.json([]);
});

router.post("/findMessages/:name", async (_req, res) => {
  res.json([]);
});

export default router;
