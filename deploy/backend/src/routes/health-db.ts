import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

router.get("/", async (_req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || "NOT SET";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET (length=" + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ")" : "NOT SET";
  
  try {
    const client = getServiceClient();
    
    // Test 1: Simple select
    const { data: instances, error: instErr } = await client
      .from("whatsapp_instances")
      .select("id, instance_name, user_id")
      .limit(5);

    // Test 2: Simple select on conversations
    const { data: convs, error: convErr } = await client
      .from("conversations")
      .select("id")
      .limit(1);

    // Test 3: Try an upsert with a dummy that we'll rollback (just test permissions)
    const testId = "00000000-0000-0000-0000-000000000000";
    const { error: upsertErr } = await client
      .from("whatsapp_instances")
      .select("id")
      .eq("user_id", testId)
      .limit(1);

    return res.json({
      ok: true,
      config: {
        SUPABASE_URL: supabaseUrl,
        SERVICE_ROLE_KEY: serviceRoleKey,
        EVOLUTION_URL: process.env.EVOLUTION_URL || "NOT SET",
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
        select_by_user: {
          success: !upsertErr,
          error: upsertErr || null,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      config: { SUPABASE_URL: supabaseUrl, SERVICE_ROLE_KEY: serviceRoleKey },
      error: err.message,
      stack: err.stack,
    });
  }
});

export default router;
