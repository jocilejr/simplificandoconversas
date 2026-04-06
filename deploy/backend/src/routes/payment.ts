import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

const MP_API = "https://api.mercadopago.com";

async function getMPTokenForUser(userId: string): Promise<string> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("platform_connections")
    .select("credentials")
    .eq("user_id", userId)
    .eq("platform", "mercadopago")
    .eq("enabled", true)
    .single();

  const token = (data?.credentials as any)?.access_token;
  if (token) return token;

  return process.env.MERCADOPAGO_ACCESS_TOKEN || "";
}

const STATUS_MAP: Record<string, string> = {
  pending: "pendente",
  approved: "aprovado",
  authorized: "autorizado",
  in_process: "processando",
  in_mediation: "em_mediacao",
  rejected: "rejeitado",
  cancelled: "cancelado",
  refunded: "reembolsado",
  charged_back: "estornado",
};

// ─── POST /create ───
router.post("/create", async (req: Request, res: Response) => {
  try {
    const token = getMPToken();
    if (!token) {
      return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" });
    }

    const authHeader = req.headers.authorization || "";
    const supabase = getServiceClient();

    // Decode JWT to get user_id
    let userId: string | null = null;
    if (authHeader) {
      const jwt = await import("jsonwebtoken");
      const decoded: any = jwt.default.verify(
        authHeader.replace("Bearer ", ""),
        process.env.JWT_SECRET || ""
      );
      userId = decoded.sub;
    }
    if (!userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_document,
      amount,
      description,
      type, // "boleto" | "pix"
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valor inválido" });
    }
    if (!customer_name) {
      return res.status(400).json({ error: "Nome do cliente obrigatório" });
    }

    // Build Mercado Pago payment body
    const paymentBody: any = {
      transaction_amount: Number(amount),
      description: description || `Cobrança - ${customer_name}`,
      payment_method_id: type === "boleto" ? "bolbradesco" : "pix",
      payer: {
        email: customer_email || "cliente@email.com",
        first_name: customer_name.split(" ")[0],
        last_name: customer_name.split(" ").slice(1).join(" ") || ".",
        identification: customer_document
          ? { type: "CPF", number: customer_document.replace(/\D/g, "") }
          : undefined,
      },
    };

    const mpResp = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${userId}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData: any = await mpResp.json();

    if (!mpResp.ok) {
      console.error("[payment] MP error:", JSON.stringify(mpData));
      return res.status(mpResp.status).json({
        error: "Erro ao criar cobrança no Mercado Pago",
        details: mpData,
      });
    }

    // Extract payment info
    const paymentUrl =
      mpData.point_of_interaction?.transaction_data?.ticket_url ||
      mpData.transaction_details?.external_resource_url ||
      "";
    const barcode =
      mpData.barcode?.content ||
      mpData.transaction_details?.digitable_line ||
      "";
    const qrCode =
      mpData.point_of_interaction?.transaction_data?.qr_code || "";
    const qrCodeBase64 =
      mpData.point_of_interaction?.transaction_data?.qr_code_base64 || "";

    // Save transaction
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        amount: Number(amount),
        type: type || "pix",
        status: STATUS_MAP[mpData.status] || "pendente",
        source: "mercadopago",
        external_id: String(mpData.id),
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_document: customer_document || null,
        description: description || null,
        payment_url: paymentUrl,
        metadata: {
          mp_status: mpData.status,
          barcode,
          qr_code: qrCode,
          payment_method: mpData.payment_method_id,
        },
        paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (txError) {
      console.error("[payment] DB error:", txError);
    }

    // Upsert conversation if phone provided
    if (customer_phone) {
      const phone = customer_phone.replace(/\D/g, "");
      const remoteJid = `${phone}@s.whatsapp.net`;

      await supabase.from("conversations").upsert(
        {
          user_id: userId,
          remote_jid: remoteJid,
          contact_name: customer_name,
          phone_number: phone,
          email: customer_email || null,
        },
        { onConflict: "user_id,remote_jid" }
      );
    }

    return res.json({
      success: true,
      transaction_id: tx?.id,
      payment_url: paymentUrl,
      barcode,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      mp_id: mpData.id,
      status: STATUS_MAP[mpData.status] || "pendente",
    });
  } catch (err: any) {
    console.error("[payment] create error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /webhook ─── Mercado Pago IPN
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    if (type === "payment") {
      const token = getMPToken();
      if (!token) return res.sendStatus(200);

      const paymentId = data?.id;
      if (!paymentId) return res.sendStatus(200);

      // Fetch payment details from MP
      const mpResp = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mpResp.ok) {
        console.error("[payment webhook] MP fetch error:", mpResp.status);
        return res.sendStatus(200);
      }

      const mpData: any = await mpResp.json();
      const newStatus = STATUS_MAP[mpData.status] || mpData.status;
      const supabase = getServiceClient();

      // Update transaction
      const updateData: any = {
        status: newStatus,
        metadata: {
          mp_status: mpData.status,
          mp_status_detail: mpData.status_detail,
          payment_method: mpData.payment_method_id,
        },
      };

      if (mpData.status === "approved") {
        updateData.paid_at = mpData.date_approved || new Date().toISOString();
      }

      await supabase
        .from("transactions")
        .update(updateData)
        .eq("external_id", String(paymentId))
        .eq("source", "mercadopago");

      console.log(`[payment webhook] Updated payment ${paymentId} → ${newStatus}`);
    }

    return res.sendStatus(200);
  } catch (err: any) {
    console.error("[payment webhook] error:", err.message);
    return res.sendStatus(200);
  }
});

// ─── GET /status/:transactionId ───
router.get("/status/:transactionId", async (req: Request, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", req.params.transactionId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    // If MP, refresh status
    if (data.source === "mercadopago" && data.external_id) {
      const token = getMPToken();
      if (token) {
        const mpResp = await fetch(`${MP_API}/v1/payments/${data.external_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mpResp.ok) {
          const mpData: any = await mpResp.json();
          const newStatus = STATUS_MAP[mpData.status] || mpData.status;
          if (newStatus !== data.status) {
            await supabase
              .from("transactions")
              .update({ status: newStatus, paid_at: mpData.status === "approved" ? mpData.date_approved : data.paid_at })
              .eq("id", data.id);
            data.status = newStatus;
          }
        }
      }
    }

    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
