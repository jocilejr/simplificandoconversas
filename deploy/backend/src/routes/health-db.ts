import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import crypto from "crypto";

const router = Router();
const BUILD_TIME = new Date().toISOString();

// GET /api/health/version — identify which build is running
router.get("/version", (_req, res) => {
  res.json({ ok: true, build_time: BUILD_TIME, node_env: process.env.NODE_ENV || "production" });
});

// POST /api/health/meta-pixel-test — isolated pixel fire test
router.post("/meta-pixel-test", async (req, res) => {
  const { pixel_id, access_token, phone } = req.body || {};
  if (!pixel_id || !access_token) {
    return res.status(400).json({ ok: false, error: "pixel_id and access_token required" });
  }
  const phoneHash = phone
    ? crypto.createHash("sha256").update(phone.replace(/\D/g, "")).digest("hex")
    : undefined;
  const eventData: any = {
    event_name: "Lead",
    event_time: Math.floor(Date.now() / 1000),
    event_id: crypto.randomUUID(),
    action_source: "chat",
    user_data: {},
  };
  if (phoneHash) {
    eventData.user_data.ph = [phoneHash];
    eventData.user_data.external_id = [phoneHash];
  }
  try {
    const metaResp = await fetch(`https://graph.facebook.com/v21.0/${pixel_id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [eventData], access_token }),
    });
    const metaResult = (await metaResp.json()) as any;
    return res.json({ ok: !metaResult.error, meta_response: metaResult, sent_payload: eventData });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/", async (_req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || "NOT SET";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET (length=" + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ")" : "NOT SET";
  
  try {
    const client = getServiceClient();
    
    const { data: instances, error: instErr } = await client
      .from("whatsapp_instances")
      .select("id, instance_name, user_id")
      .limit(5);

    const { data: convs, error: convErr } = await client
      .from("conversations")
      .select("id")
      .limit(1);

    const { data: pixels, error: pixelErr } = await client
      .from("meta_pixels")
      .select("id, pixel_id, user_id")
      .limit(5);

    const testId = "00000000-0000-0000-0000-000000000000";
    const { error: upsertErr } = await client
      .from("whatsapp_instances")
      .select("id")
      .eq("user_id", testId)
      .limit(1);

    return res.json({
      ok: true,
      build_time: BUILD_TIME,
      config: {
        SUPABASE_URL: supabaseUrl,
        SERVICE_ROLE_KEY: serviceRoleKey,
        BAILEYS_URL: process.env.BAILEYS_URL || process.env.EVOLUTION_URL || "NOT SET",
        GOTRUE_URL: process.env.GOTRUE_URL || "NOT SET",
      },
      tests: {
        whatsapp_instances: {
          success: !instErr,
          error: instErr || null,
          rowCount: instances?.length ?? 0,
          sample: instances?.map(i => ({ id: i.id, instance_name: i.instance_name, user_id: i.user_id })),
        },
        conversations: {
          success: !convErr,
          error: convErr || null,
          rowCount: convs?.length ?? 0,
        },
        meta_pixels: {
          success: !pixelErr,
          error: pixelErr || null,
          rowCount: pixels?.length ?? 0,
          sample: pixels?.map(p => ({ id: p.id, pixel_id: p.pixel_id, user_id: p.user_id })),
        },
        select_by_user: {
          success: !upsertErr,
          error: upsertErr || null,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      build_time: BUILD_TIME,
      config: { SUPABASE_URL: supabaseUrl, SERVICE_ROLE_KEY: serviceRoleKey },
      error: err.message,
      stack: err.stack,
    });
  }
});

export default router;
