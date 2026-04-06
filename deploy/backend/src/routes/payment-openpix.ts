import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

const OPENPIX_API = "https://api.openpix.com.br/api/openpix/v1";

async function getOpenpixAppId(userId: string): Promise<string> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("platform_connections")
    .select("credentials")
    .eq("user_id", userId)
    .eq("platform", "openpix")
    .eq("enabled", true)
    .single();

  return (data?.credentials as any)?.app_id || "";
}

// ─── POST /create ─── Cria cobrança PIX via OpenPix
router.post("/create", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || "";
    const supabase = getServiceClient();

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

    const appId = await getOpenpixAppId(userId);
    if (!appId) {
      return res.status(500).json({ error: "OpenPix App ID não configurado. Configure na aba Integrações." });
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_document,
      amount,
      description,
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valor inválido" });
    }
    if (!customer_name) {
      return res.status(400).json({ error: "Nome do cliente obrigatório" });
    }

    const correlationID = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const valueCents = Math.round(Number(amount) * 100);

    const chargeBody: any = {
      correlationID,
      value: valueCents,
      comment: description || `Cobrança - ${customer_name}`,
      customer: {
        name: customer_name,
        ...(customer_phone ? { phone: customer_phone.replace(/\D/g, "") } : {}),
        ...(customer_email ? { email: customer_email } : {}),
        ...(customer_document ? { taxID: { taxID: customer_document.replace(/\D/g, ""), type: "CPF" } } : {}),
      },
    };

    console.log("[openpix] Creating charge:", JSON.stringify(chargeBody));

    const opResp = await fetch(`${OPENPIX_API}/charge`, {
      method: "POST",
      headers: {
        Authorization: appId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chargeBody),
    });

    const opData: any = await opResp.json();

    if (!opResp.ok) {
      console.error("[openpix] API error:", JSON.stringify(opData));
      return res.status(opResp.status).json({
        error: "Erro ao criar cobrança na OpenPix",
        details: opData,
      });
    }

    const charge = opData.charge || {};
    const paymentUrl = charge.paymentLinkUrl || "";
    const qrCodeImage = charge.qrCodeImage || "";
    const brCode = charge.brCode || "";

    // Save transaction
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        amount: Number(amount),
        type: "pix",
        status: "pendente",
        source: "openpix",
        external_id: correlationID,
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_document: customer_document || null,
        description: description || null,
        payment_url: paymentUrl,
        metadata: {
          openpix_charge_id: charge.id || null,
          correlation_id: correlationID,
          br_code: brCode,
        },
      })
      .select()
      .single();

    if (txError) {
      console.error("[openpix] DB insert FAILED:", JSON.stringify(txError));
      return res.status(500).json({
        error: "Cobrança criada na OpenPix mas falhou ao salvar no banco de dados",
        db_error: txError.message,
      });
    }

    console.log("[openpix] Transaction saved:", tx?.id);

    return res.json({
      success: true,
      transaction_id: tx?.id,
      payment_url: paymentUrl,
      barcode: "",
      qr_code: brCode,
      qr_code_base64: qrCodeImage,
      mp_id: 0,
      status: "pendente",
    });
  } catch (err: any) {
    console.error("[openpix] create error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /webhook ─── Recebe webhooks da OpenPix (sem JWT)
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const event = body.event || "";
    const charge = body.charge || {};
    const correlationID = charge.correlationID || "";

    console.log(`[openpix webhook] Event: ${event}, correlationID: ${correlationID}`);

    if (!correlationID) {
      return res.sendStatus(200);
    }

    const supabase = getServiceClient();

    if (event === "OPENPIX:CHARGE_COMPLETED") {
      const pix = Array.isArray(body.pix) ? body.pix[0] : body.pix;
      await supabase
        .from("transactions")
        .update({
          status: "aprovado",
          paid_at: pix?.time || new Date().toISOString(),
          metadata: {
            openpix_charge_id: charge.id || null,
            correlation_id: correlationID,
            pix_transaction_id: pix?.transactionID || null,
            pix_e2e: pix?.endToEndId || null,
          },
        })
        .eq("external_id", correlationID)
        .eq("source", "openpix");

      console.log(`[openpix webhook] Charge ${correlationID} → aprovado`);
    } else if (event === "OPENPIX:CHARGE_EXPIRED") {
      await supabase
        .from("transactions")
        .update({ status: "cancelado" })
        .eq("external_id", correlationID)
        .eq("source", "openpix");

      console.log(`[openpix webhook] Charge ${correlationID} → cancelado`);
    }

    return res.sendStatus(200);
  } catch (err: any) {
    console.error("[openpix webhook] error:", err.message);
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

    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
