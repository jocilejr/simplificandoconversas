import { Router } from "express";
import {
  deleteInstance,
  getConnectionState,
  getInstance,
  listInstances,
  logoutInstance,
  restartInstance,
  startInstance,
} from "../instance-manager";

const router = Router();

/* ───────── Instance management ───────── */

router.post("/create", async (req, res) => {
  const name = String(req.body?.instanceName || "").trim();
  if (!name) return res.status(400).json({ error: "instanceName required" });
  await startInstance(name);
  const inst = getInstance(name);
  res.json({
    instance: { instanceName: name, status: inst?.status || "connecting" },
    qrcode: inst?.qr ? { code: inst.qrRaw, base64: inst.qr } : null,
  });
});

router.get("/connect/:name", async (req, res) => {
  const name = req.params.name;
  await startInstance(name);
  // Aguarda QR até 8s
  const inst = getInstance(name);
  const start = Date.now();
  while (inst && !inst.qr && inst.status !== "open" && Date.now() - start < 8000) {
    await new Promise((r) => setTimeout(r, 250));
  }
  res.json({
    instance: { instanceName: name, status: inst?.status || "connecting" },
    base64: inst?.qr || null,
    code: inst?.qrRaw || null,
    qrcode: inst?.qr ? { code: inst.qrRaw, base64: inst.qr } : null,
  });
});

router.get("/connectionState/:name", (req, res) => {
  res.json(getConnectionState(req.params.name));
});

router.delete("/logout/:name", async (req, res) => {
  await logoutInstance(req.params.name);
  res.json({ status: "SUCCESS" });
});

router.delete("/delete/:name", async (req, res) => {
  await deleteInstance(req.params.name);
  res.json({ status: "SUCCESS" });
});

router.put("/restart/:name", async (req, res) => {
  await restartInstance(req.params.name);
  res.json({ status: "SUCCESS" });
});

router.get("/fetchInstances", (_req, res) => {
  res.json(listInstances());
});

export default router;
