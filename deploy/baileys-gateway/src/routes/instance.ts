import { Router } from "express";
import {
  getOrCreate,
  getInstance,
  listAllInstances,
  logout,
  destroy,
} from "../instance-manager";
import { requireApiKey } from "../lib/http";

const router = Router();
router.use(requireApiKey);

/** POST /instance/create  body: { instanceName, integration?, qrcode? } */
router.post("/create", async (req, res) => {
  const { instanceName } = req.body || {};
  if (!instanceName) return res.status(400).json({ error: "instanceName required" });
  const runtime = await getOrCreate(instanceName);
  res.json({
    instance: { instanceName, status: runtime.state },
    hash: { apikey: process.env.BAILEYS_API_KEY || "" },
    qrcode: runtime.qr ? { base64: runtime.qr } : undefined,
  });
});

/** GET /instance/connect/:name  → returns QR code (Evolution-compatible) */
router.get("/connect/:name", async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const runtime = await getOrCreate(name);

  // Wait briefly for QR to appear
  const start = Date.now();
  while (!runtime.qr && runtime.state !== "open" && Date.now() - start < 5_000) {
    await new Promise((r) => setTimeout(r, 250));
  }

  if (runtime.state === "open") {
    return res.json({ instance: { instanceName: name, state: "open" } });
  }
  if (runtime.qr) {
    // Strip the "data:image/png;base64," prefix to match Evolution's `base64`
    const base64 = runtime.qr.replace(/^data:image\/[a-z]+;base64,/, "");
    return res.json({
      pairingCode: null,
      code: base64,
      base64: runtime.qr, // full data URL (some clients want this)
      count: 1,
    });
  }
  res.json({ instance: { instanceName: name, state: runtime.state } });
});

/** GET /instance/connectionState/:name */
router.get("/connectionState/:name", async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const runtime = getInstance(name);
  if (!runtime) {
    return res.json({ instance: { instanceName: name, state: "close" } });
  }
  res.json({ instance: { instanceName: name, state: runtime.state }, state: runtime.state });
});

/** GET /instance/fetchInstances?instanceName=... */
router.get("/fetchInstances", async (req, res) => {
  const filter = (req.query.instanceName as string | undefined) || null;
  const all = listAllInstances();
  const data = (filter ? all.filter((i) => i.name === filter) : all).map((r) => ({
    instance: {
      instanceName: r.name,
      state: r.state,
      status: r.state,
    },
    instanceName: r.name,
    state: r.state,
    status: r.state,
    ownerJid: r.ownerJid,
    profileName: r.profileName,
    profilePicUrl: r.profilePicUrl,
  }));
  res.json(filter ? data : data);
});

/** DELETE /instance/logout/:name */
router.delete("/logout/:name", async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  await logout(name);
  res.json({ status: "SUCCESS", error: false, response: { message: "Instance logged out" } });
});

/** DELETE /instance/delete/:name */
router.delete("/delete/:name", async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  await destroy(name);
  res.json({ status: "SUCCESS", error: false, response: { message: "Instance deleted" } });
});

export default router;
