import { Router } from "express";
import { getInstance, getOrCreate } from "../instance-manager";
import { requireApiKey, toJid } from "../lib/http";
import { downloadAsBase64 } from "../lib/media";

const router = Router();
router.use(requireApiKey);

async function getSock(name: string) {
  let runtime = getInstance(name);
  if (!runtime || !runtime.sock) runtime = await getOrCreate(name);
  if (!runtime.sock) throw new Error(`Instance ${name} has no socket`);
  if (runtime.state !== "open") throw new Error(`Instance ${name} not connected`);
  return runtime.sock;
}

/** POST /chat/whatsappNumbers/:instance  body: { numbers: string[] }  → array of { jid, exists } */
router.post("/whatsappNumbers/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { numbers } = req.body || {};
    const list = Array.isArray(numbers) ? numbers : [];
    const results = await Promise.all(
      list.map(async (n: string) => {
        try {
          const [info] = await sock.onWhatsApp(toJid(n));
          return {
            jid: info?.jid || toJid(n),
            number: n,
            exists: !!info?.exists,
          };
        } catch {
          return { jid: toJid(n), number: n, exists: false };
        }
      })
    );
    res.json(results);
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "check failed" });
  }
});

/** POST /chat/getBase64FromMediaMessage/:instance  body: { message, convertToMp4? } */
router.post("/getBase64FromMediaMessage/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { message } = req.body || {};
    const msg = message?.message ? message : { message };
    const inner = msg.message || {};
    const type =
      (inner.imageMessage && "image") ||
      (inner.videoMessage && "video") ||
      (inner.audioMessage && "audio") ||
      (inner.documentMessage && "document") ||
      (inner.stickerMessage && "sticker") ||
      "document";
    const base64 = await downloadAsBase64(sock, msg, type as any);
    if (!base64) return res.status(404).json({ error: "media not available" });
    const mediaNode = inner.imageMessage || inner.videoMessage || inner.audioMessage || inner.documentMessage || inner.stickerMessage;
    res.json({
      base64,
      mimetype: mediaNode?.mimetype || "application/octet-stream",
      fileName: mediaNode?.fileName || null,
    });
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "download failed" });
  }
});

/** POST /chat/findChats/:instance — returns empty array.
 *  Baileys does not expose a chat list (no on-demand history).
 *  Backend can still operate using the messages.upsert webhook stream and
 *  its own `conversations` table populated from inbound traffic.
 */
router.post("/findChats/:instance", async (_req, res) => {
  res.json([]);
});

export default router;
