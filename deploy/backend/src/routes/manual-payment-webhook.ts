import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { dispatchRecovery } from "../lib/recovery-dispatch";

const router = Router();

/**
 * POST /api/manual-payment/webhook
 *
 * Open webhook for receiving PIX/Card payment notifications.
 * No authentication required — designed for internal system-to-system calls.
 *
 * Required fields:
 *   workspace_id: string           — workspace UUID
 *   event: string                  — see events below
 *   external_id: string            — unique ID from the external system
 *
 * Events:
 *   "payment_pending"    → status "pendente"
 *   "payment_approved"   → status "aprovado"
 *   "payment_refused"    → status "rejeitado"
 *   "payment_refunded"   → status "reembolsado"
 *   "payment_chargeback" → status "chargeback"
 *
 * Optional fields:
 *   type: "pix" | "cartao" | "boleto"   (default: "pix")
 *   amount: number                       (in BRL, e.g. 99.90)
 *   customer_name: string
 *   customer_email: string
 *   customer_phone: string               (will be normalized to digits only)
 *   customer_document: string
 *   description: string
 *   payment_url: string
 *   paid_at: string                      (ISO date)
 *   metadata: object                     (any extra data)
 */
router.post("/webhook", async (req, res) => {
  const sb = getServiceClient();
  const {
    workspace_id: workspaceId,
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

  if (!workspaceId) return res.status(400).json({ error: "workspace_id is required" });
  if (!event) return res.status(400).json({ error: "event is required" });

  // Validate workspace exists and get owner
  const { data: ws } = await sb
    .from("workspaces")
    .select("id, created_by")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!ws) return res.status(404).json({ error: "Workspace not found" });

  const userId = ws.created_by;

  // Normalize type
  const typeMap: Record<string, string> = {
    pix: "pix",
    cartao: "cartao",
    card: "cartao",
    credit_card: "cartao",
    debit_card: "cartao",
    boleto: "boleto",
    billet: "boleto",
  };
  const paymentType = typeMap[(type || "pix").toLowerCase()] || "pix";
  const cleanPhone = customer_phone ? customer_phone.replace(/\D/g, "") : null;

  // Map event to status
  const statusMap: Record<string, string> = {
    payment_pending: "pendente",
    payment_approved: "aprovado",
    payment_refused: "rejeitado",
    payment_refunded: "reembolsado",
    payment_chargeback: "chargeback",
  };
  const txStatus = statusMap[event];
  if (!txStatus) {
    return res.status(400).json({
      error: `Invalid event "${event}". Valid events: ${Object.keys(statusMap).join(", ")}`,
    });
  }

  try {
    // If external_id provided, try to find and update existing transaction
    let existing: { id: string } | null = null;
    if (external_id) {
      const externalKey = `manual_${paymentType}_${external_id}`;
      existing = (await sb
        .from("transactions")
        .select("id")
        .eq("external_id", externalKey)
        .eq("workspace_id", workspaceId)
        .maybeSingle()).data;
    }

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
      console.log(`[manual-payment] Updated ${existing.id} → ${txStatus}`);
      return res.json({ ok: true, action: "updated", id: existing.id });
    }

    // Create new transaction
    const { data: newTx, error: insertErr } = await sb
      .from("transactions")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        external_id: external_id ? `manual_${paymentType}_${external_id}` : null,
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

    console.log(`[manual-payment] Created ${newTx?.id} (${paymentType} ${txStatus})`);

    // Enqueue for recovery if pending/rejected
    if (newTx?.id && (txStatus === "pendente" || txStatus === "rejeitado")) {
      await enqueueRecovery({
        workspaceId,
        userId,
        transactionId: newTx.id,
        customerPhone: cleanPhone,
        customerName: customer_name || null,
        amount: amount !== undefined ? Number(amount) : 0,
        transactionType: paymentType,
      }).catch((e: any) => console.error("[manual-payment] enqueue error:", e.message));
    }

    return res.json({ ok: true, action: "created", id: newTx?.id });
  } catch (err: any) {
    console.error("[manual-payment] error:", err.message);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// GET for health check
router.get("/webhook", (_req, res) => {
  res.json({
    ok: true,
    service: "manual-payment-webhook",
    events: [
      "payment_pending",
      "payment_approved",
      "payment_refused",
      "payment_refunded",
      "payment_chargeback",
    ],
    types: ["pix", "cartao", "boleto"],
    required_fields: ["workspace_id", "event", "external_id"],
    optional_fields: [
      "type",
      "amount",
      "customer_name",
      "customer_email",
      "customer_phone",
      "customer_document",
      "description",
      "payment_url",
      "paid_at",
      "metadata",
    ],
  });
});

export default router;
