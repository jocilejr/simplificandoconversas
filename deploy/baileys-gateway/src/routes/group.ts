import { Router } from "express";
import { getInstance } from "../instance-manager";

const router = Router();

router.get("/fetchAllGroups/:name", async (req, res) => {
  const inst = getInstance(req.params.name);
  if (!inst?.sock) return res.status(409).json({ error: "instance not connected" });
  try {
    const groups = await inst.sock.groupFetchAllParticipating();
    res.json(Object.values(groups));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/inviteCode/:name", async (req, res) => {
  const inst = getInstance(req.params.name);
  if (!inst?.sock) return res.status(409).json({ error: "instance not connected" });
  const groupJid = String(req.query.groupJid || "");
  if (!groupJid) return res.status(400).json({ error: "groupJid required" });
  try {
    const code = await inst.sock.groupInviteCode(groupJid);
    res.json({ inviteCode: code, inviteUrl: `https://chat.whatsapp.com/${code}` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
