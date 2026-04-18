import { Router } from "express";
import { getInstance, getOrCreate } from "../instance-manager";
import { requireApiKey, toGroupJid } from "../lib/http";

const router = Router();
router.use(requireApiKey);

async function getSock(name: string) {
  let runtime = getInstance(name);
  if (!runtime || !runtime.sock) runtime = await getOrCreate(name);
  if (!runtime.sock) throw new Error(`Instance ${name} has no socket`);
  if (runtime.state !== "open") throw new Error(`Instance ${name} not connected`);
  return runtime.sock;
}

/** GET /group/fetchAllGroups/:instance?getParticipants=true */
router.get("/fetchAllGroups/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const groups = await sock.groupFetchAllParticipating();
    const arr = Object.values(groups).map((g: any) => ({
      id: g.id,
      jid: g.id,
      groupJid: g.id,
      subject: g.subject,
      name: g.subject,
      size: Array.isArray(g.participants) ? g.participants.length : 0,
      participants: g.participants || [],
      owner: g.owner || "",
      desc: g.desc || "",
      creation: g.creation || 0,
    }));
    res.json(arr);
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "fetch failed" });
  }
});

/** GET /group/findGroupInfos/:instance?groupJid=xxx@g.us */
router.get("/findGroupInfos/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const groupJid = (req.query.groupJid as string) || "";
    const meta = await sock.groupMetadata(toGroupJid(groupJid));
    res.json({
      id: meta.id,
      subject: meta.subject,
      desc: meta.desc,
      owner: meta.owner,
      participants: meta.participants,
      size: meta.participants?.length || 0,
    });
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "info failed" });
  }
});

/** POST /group/inviteCode/:instance  body: { groupJid }  → returns invite link */
router.post("/inviteCode/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { groupJid } = req.body || {};
    const code = await sock.groupInviteCode(toGroupJid(groupJid));
    res.json({ inviteCode: code, inviteUrl: `https://chat.whatsapp.com/${code}` });
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "invite failed" });
  }
});

/** POST /group/acceptInviteCode/:instance  body: { inviteCode } */
router.post("/acceptInviteCode/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { inviteCode } = req.body || {};
    const groupJid = await sock.groupAcceptInvite(String(inviteCode || "").trim());
    res.json({ groupJid });
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "accept failed" });
  }
});

/** POST /group/updateParticipant/:instance  body: { groupJid, action, participants } */
router.post("/updateParticipant/:instance", async (req, res) => {
  try {
    const sock = await getSock(decodeURIComponent(req.params.instance));
    const { groupJid, action, participants } = req.body || {};
    const result = await sock.groupParticipantsUpdate(
      toGroupJid(groupJid),
      Array.isArray(participants) ? participants : [participants],
      action
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ status: 400, error: err?.message || "update failed" });
  }
});

export default router;
