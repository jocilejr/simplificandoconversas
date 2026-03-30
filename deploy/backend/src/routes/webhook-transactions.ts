import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

interface NormalizedTransaction {
  external_id: string;
  source: string;
  type: string;
  status: string;
  amount: number;
  description?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_document?: string;
  paid_at?: string;
  metadata?: any;
}

async function fetchMercadoPagoPayment(paymentId: string, accessToken: string): Promise<any> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error(`[webhook-transactions] MP API error: ${res.status} ${res.statusText}`);
    return null;
  }
  return res.json();
}

function normalizeMercadoPagoPayment(payment: any, rawBody: any): NormalizedTransaction | null {
  if (!payment?.id) return null;

  const statusMap: Record<string, string> = {
    approved: "pago",
    pending: "pendente",
    in_process: "pendente",
    rejected: "cancelado",
    cancelled: "cancelado",
    refunded: "reembolsado",
    charged_back: "reembolsado",
  };
  const status = statusMap[payment.status] || "pendente";

  const ptMap: Record<string, string> = {
    credit_card: "cartao",
    debit_card: "cartao",
    prepaid_card: "cartao",
    bank_transfer: "pix",
    pix: "pix",
    ticket: "boleto",
    bolbradesco: "boleto",
  };
  const type = ptMap[payment.payment_type_id] || "pix";

  const payer = payment.payer || {};
  return {
    external_id: String(payment.id),
    source: "mercadopago",
    type,
    status,
    amount: Number(payment.transaction_amount || 0),
    description: payment.description || payment.reason,
    customer_name: payer.first_name
      ? `${payer.first_name} ${payer.last_name || ""}`.trim()
      : undefined,
    customer_email: payer.email,
    customer_phone: payer.phone?.number,
    customer_document: payer.identification?.number,
    paid_at: status === "pago" ? (payment.date_approved || new Date().toISOString()) : undefined,
    metadata: { webhook: rawBody, payment },
  };
}

function normalizeOpenPix(body: any): NormalizedTransaction | null {
  const charge = body.charge || body.pix?.[0] || body;
  if (!charge) return null;

  const externalId = charge.correlationID || charge.transactionID || charge.identifier;
  if (!externalId) return null;

  let status = "pendente";
  const event = body.event || "";
  if (event.includes("COMPLETED") || charge.status === "COMPLETED") status = "pago";
  else if (event.includes("EXPIRED") || charge.status === "EXPIRED") status = "expirado";

  return {
    external_id: String(externalId),
    source: "openpix",
    type: "pix",
    status,
    amount: Number(charge.value || 0) / 100,
    description: charge.comment || charge.description,
    customer_name: charge.customer?.name,
    customer_email: charge.customer?.email,
    customer_phone: charge.customer?.phone,
    customer_document: charge.customer?.taxID?.taxID || charge.customer?.cpf,
    paid_at: status === "pago" ? (charge.paidAt || new Date().toISOString()) : undefined,
    metadata: body,
  };
}

function normalizeYampi(body: any): NormalizedTransaction | null {
  const resource = body.resource || body.data || body;
  if (!resource) return null;

  const externalId = resource.id || resource.number;
  if (!externalId) return null;

  let status = "pendente";
  const st = (resource.status?.data?.alias || resource.status || "").toLowerCase();
  if (["paid", "approved", "pago"].includes(st)) status = "pago";
  else if (["cancelled", "canceled", "cancelado"].includes(st)) status = "cancelado";
  else if (["expired", "expirado"].includes(st)) status = "expirado";

  const paymentType = (resource.transactions?.[0]?.payment_method || resource.payment_method || "").toLowerCase();
  let type = "pix";
  if (paymentType.includes("boleto")) type = "boleto";
  else if (paymentType.includes("credit") || paymentType.includes("cartao") || paymentType.includes("card")) type = "cartao";

  return {
    external_id: String(externalId),
    source: "yampi",
    type,
    status,
    amount: Number(resource.value_total || resource.amount || 0),
    description: resource.products?.map((p: any) => p.name).join(", "),
    customer_name: resource.customer?.name || `${resource.customer?.first_name || ""} ${resource.customer?.last_name || ""}`.trim(),
    customer_email: resource.customer?.email,
    customer_phone: resource.customer?.phone?.full_number || resource.customer?.phone,
    customer_document: resource.customer?.cpf || resource.customer?.cnpj,
    paid_at: status === "pago" ? (resource.paid_at || new Date().toISOString()) : undefined,
    metadata: body,
  };
}

const normalizers: Record<string, (body: any) => NormalizedTransaction | null> = {
  mercadopago: normalizeMercadoPago,
  openpix: normalizeOpenPix,
  yampi: normalizeYampi,
};

// GET /api/webhook-transactions/:source — health check for webhook validation (e.g. OpenPix)
router.get("/:source", (req: Request, res: Response) => {
  console.log(`[webhook-transactions] GET validation from ${req.params.source}`);
  res.status(200).json({ ok: true, source: req.params.source });
});

// POST /api/webhook-transactions/:source
router.post("/:source", async (req: Request, res: Response) => {
  const { source } = req.params;
  console.log(`[webhook-transactions] Received from ${source}`);

  const normalizer = normalizers[source];
  if (!normalizer) {
    // Generic source — store raw
    const supabase = getServiceClient();
    const { error } = await supabase.from("transactions").insert({
      user_id: req.query.user_id as string || "00000000-0000-0000-0000-000000000000",
      external_id: req.body?.id || req.body?.data?.id || null,
      source,
      type: "pix",
      status: "pendente",
      amount: 0,
      metadata: req.body,
    });
    if (error) console.error(`[webhook-transactions] insert error:`, error.message);
    return res.json({ ok: true });
  }

  try {
    const normalized = normalizer(req.body);
    if (!normalized) {
      console.warn(`[webhook-transactions] Could not normalize payload from ${source}`);
      return res.json({ ok: true, skipped: true });
    }

    const supabase = getServiceClient();

    // Try to find existing by external_id + source to get user_id
    const userId = (req.query.user_id as string) || (req.headers["x-user-id"] as string);

    if (!userId) {
      // Try upsert by external_id
      const { data: existing } = await supabase
        .from("transactions")
        .select("id, user_id")
        .eq("source", normalized.source)
        .eq("external_id", normalized.external_id)
        .limit(1)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("transactions")
          .update({
            status: normalized.status,
            amount: normalized.amount,
            paid_at: normalized.paid_at,
            metadata: normalized.metadata,
            customer_name: normalized.customer_name,
            customer_email: normalized.customer_email,
            customer_phone: normalized.customer_phone,
            customer_document: normalized.customer_document,
          })
          .eq("id", existing.id);
        if (error) console.error(`[webhook-transactions] update error:`, error.message);
        return res.json({ ok: true, action: "updated", id: existing.id });
      }

      console.warn(`[webhook-transactions] No user_id provided and no existing record for ${source}/${normalized.external_id}`);
      return res.status(400).json({ error: "user_id required for new transactions" });
    }

    // Upsert
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("source", normalized.source)
      .eq("external_id", normalized.external_id)
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("transactions")
        .update({
          status: normalized.status,
          amount: normalized.amount,
          paid_at: normalized.paid_at,
          metadata: normalized.metadata,
          customer_name: normalized.customer_name,
          customer_email: normalized.customer_email,
          customer_phone: normalized.customer_phone,
          customer_document: normalized.customer_document,
        })
        .eq("id", existing.id);
      if (error) console.error(`[webhook-transactions] update error:`, error.message);
      return res.json({ ok: true, action: "updated", id: existing.id });
    }

    const { data, error } = await supabase.from("transactions").insert({
      user_id: userId,
      ...normalized,
    }).select("id").single();

    if (error) {
      console.error(`[webhook-transactions] insert error:`, error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true, action: "created", id: data?.id });
  } catch (err: any) {
    console.error(`[webhook-transactions] error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
