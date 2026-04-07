import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

/**
 * POST /api/manual-payment/webhook
 *
 * Generic webhook for receiving PIX and Card payment notifications.
 * Authenticated via X-Webhook-Secret header matched against
 * platform_connections where platform = 'manual_payment'.
 *
 * Payload:
 * {
 *   event: "payment_pending" | "payment_approved" | "payment_refused" | "payment_refunded",
 *   type: "pix" | "cartao",
 *   external_id: string,          // unique ID from the external system
 *   amount: number,               // in BRL (e.g. 99.90)
 *   customer_name?: string,
 *   customer_email?: string,
 *   customer_phone?: string,
 *   customer_document?: string,
 *   description?: string,
 *   payment_url?: string,
 *   paid_at?: string,             // ISO date, for approved events
 *   metadata?: object,
 * }
 */
router.post("/webhook", async (req, res) => {
  const secret = (req.headers["x-webhook-secret"] as string) || "";
  if (!secret || secret.length < 8) {
    return res.status(401).json({ error: "Missing or invalid X-Webhook-Secret header" });
  }

  const sb = getServiceClient();

  // Resolve connection by secret
  const { data: connections } = await sb
    .from("platform_connections")
    .select("user_id, workspace_id, enabled")
    .eq("platform", "manual_payment")
    .eq("enabled", true);

  let matched: { user_id: string; workspace_id: string } | null = null;
  for (const conn of connections || []) {
    const creds = conn as any;
    // credentials is JSONB; we need to fetch it
    const { data: full } = await sb
      .from("platform_connections")
      .select("credentials")
      .eq("user_id", conn.user_id)
      .eq("platform", "manual_payment")
      .single();

    const storedSecret = (full?.credentials as any)?.webhook_secret;
    if (storedSecret && storedSecret === secret) {
      matched = { user_id: conn.user_id, workspace_id: conn.workspace_id };
      break;
    }
  }

  if (!matched) {
    return res.status(401).json({ error: "Invalid webhook secret" });
  }

  const { user_id: userId, workspace_id: workspaceId } = matched;
  const {
    event,
    type,
    external_id,
    amount,
    customer_name,
    customer_email,
    customer_phone,
    customer_document,
    description,
    payment_url,
    paid_at,
    metadata,
  } = req.body;

  if (!event) return res.status(400).json({ error: "event is required" });
  if (!external_id) return res.status(400).json({ error: "external_id is required" });

  const paymentType = type === "cartao" || type === "credit_card" || type === "card" ? "cartao" : "pix";
  const cleanPhone = customer_phone ? customer_phone.replace(/\D/g, "") : null;

  // Map event to status
  const statusMap: Record<string, string> = {
    payment_pending: "pendente",
    payment_approved: "aprovado",
    payment_refused: "rejeitado",
    payment_refunded: "reembolsado",
  };
  const txStatus = statusMap[event] || "pendente";
  const externalKey = `manual_${paymentType}_${external_id}`;

  try {
    // Try update first (idempotent)
    const { data: existing } = await sb
      .from("transactions")
      .select("id")
      .eq("external_id", externalKey)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (existing) {
      const updates: any = { status: txStatus };
      if (paid_at) updates.paid_at = paid_at;
      if (amount !== undefined) updates.amount = Number(amount);
      if (customer_name) updates.customer_name = customer_name;
      if (customer_email) updates.customer_email = customer_email;
      if (cleanPhone) updates.customer_phone = cleanPhone;
      if (customer_document) updates.customer_document = customer_document;
      if (metadata) updates.metadata = metadata;
      if (payment_url) updates.payment_url = payment_url;

      await sb.from("transactions").update(updates).eq("id", existing.id);
      console.log(`[manual-payment] Updated transaction ${existing.id} → ${txStatus}`);
      return res.json({ ok: true, action: "updated", id: existing.id });
    }

    // Create new
    const { data: newTx, error: insertErr } = await sb
      .from("transactions")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        external_id: externalKey,
        amount: amount !== undefined ? Number(amount) : 0,
        type: paymentType,
        status: txStatus,
        source: "manual_webhook",
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        customer_phone: cleanPhone || null,
        customer_document: customer_document || null,
        description: description || null,
        payment_url: payment_url || null,
        paid_at: txStatus === "aprovado" ? (paid_at || new Date().toISOString()) : null,
        metadata: metadata || null,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[manual-payment] Insert error:", insertErr.message);
      return res.status(500).json({ error: insertErr.message });
    }

    console.log(`[manual-payment] Created transaction ${newTx?.id} (${paymentType} ${txStatus})`);
    return res.json({ ok: true, action: "created", id: newTx?.id });
  } catch (err: any) {
    console.error("[manual-payment] error:", err.message);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET for health/validation
router.get("/webhook", (_req, res) => {
  res.json({ ok: true, service: "manual-payment-webhook" });
});

export default router;
