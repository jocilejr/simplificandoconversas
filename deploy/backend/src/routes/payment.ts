import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";
import { resolveWorkspaceId } from "../lib/workspace";
import { getRandomCep } from "../lib/random-ceps";
import { lookupCep } from "../lib/cep-lookup";
import fs from "fs/promises";
import path from "path";

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

/**
 * Download and save the boleto PDF to the local filesystem.
 * Returns the public path (/media/userId/boletos/mpId.pdf) or null on failure.
 */
async function downloadAndSaveBoletoPdf(
  paymentUrl: string,
  userId: string,
  mpId: string | number
): Promise<string | null> {
  if (!paymentUrl) {
    console.warn("[payment] No paymentUrl provided for boleto PDF download");
    return null;
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[payment] Downloading boleto PDF attempt ${attempt}/${maxRetries}: ${paymentUrl}`);
      const pdfResp = await fetch(paymentUrl, {
        headers: { "Accept": "application/pdf" },
        redirect: "follow",
      });

      if (!pdfResp.ok) {
        console.warn(`[payment] PDF download HTTP ${pdfResp.status} on attempt ${attempt}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        return null;
      }

      const contentType = pdfResp.headers.get("content-type") || "";
      const buffer = Buffer.from(await pdfResp.arrayBuffer());

      // Validate it's actually a PDF (check magic bytes %PDF)
      if (buffer.length < 5) {
        console.warn(`[payment] PDF response too small (${buffer.length} bytes) on attempt ${attempt}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        return null;
      }

      const header = buffer.subarray(0, 5).toString("ascii");
      if (!header.startsWith("%PDF")) {
        // It might be HTML (redirect page) — not a real PDF
        console.warn(`[payment] Response is not PDF (starts with "${header}", content-type: ${contentType}) on attempt ${attempt}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        return null;
      }

      // Save to filesystem
      const dir = `/media-files/${userId}/boletos`;
      await fs.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${mpId}.pdf`);
      await fs.writeFile(filePath, buffer);
      const publicPath = `/media/${userId}/boletos/${mpId}.pdf`;
      console.log(`[payment] Boleto PDF saved successfully: ${filePath} (${buffer.length} bytes)`);
      return publicPath;
    } catch (err: any) {
      console.error(`[payment] PDF download error on attempt ${attempt}:`, err.message);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
    }
  }

  return null;
}

// ─── POST /create ───
router.post("/create", async (req: Request, res: Response) => {
  try {
    console.log("[payment] Starting payment creation...");
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
    const workspaceId = await resolveWorkspaceId(userId);

    const token = await getMPTokenForUser(userId);
    if (!token) {
      return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado. Configure na aba Integrações." });
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

    // Resolve email: check conversations table, fallback to fixed email
    const FALLBACK_EMAIL = "businessvivaorigem@gmail.com";
    let resolvedEmail = customer_email;
    if (!resolvedEmail && customer_phone) {
      const phone = customer_phone.replace(/\D/g, "");
      const { data: conv } = await supabase
        .from("conversations")
        .select("email")
        .eq("user_id", userId)
        .eq("phone_number", phone)
        .not("email", "is", null)
        .limit(1)
        .maybeSingle();
      resolvedEmail = conv?.email || FALLBACK_EMAIL;
      console.log(`[payment] Resolved email for phone ${phone}: ${resolvedEmail}`);
    }
    if (!resolvedEmail) resolvedEmail = FALLBACK_EMAIL;

    // Build Mercado Pago payment body
    const paymentBody: any = {
      transaction_amount: Number(amount),
      description: description || `Cobrança - ${customer_name}`,
      payment_method_id: type === "boleto" ? "bolbradesco" : "pix",
      payer: {
        email: resolvedEmail,
        first_name: customer_name.split(" ")[0],
        last_name: customer_name.split(" ").slice(1).join(" ") || ".",
        identification: customer_document
          ? { type: "CPF", number: customer_document.replace(/\D/g, "") }
          : undefined,
      },
    };

    // Inject random address for boleto
    if (type === "boleto") {
      try {
        const cep = getRandomCep();
        const addr = await lookupCep(cep);
        paymentBody.payer.address = addr;
        console.log(`[payment] Boleto address: CEP ${addr.zip_code} - ${addr.street_name}, ${addr.city}/${addr.federal_unit}`);
      } catch (addrErr: any) {
        console.warn("[payment] Failed to lookup CEP, using fallback:", addrErr.message);
        paymentBody.payer.address = {
          zip_code: "01001000",
          street_name: "Praça da Sé",
          street_number: "s/n",
          neighborhood: "Sé",
          city: "São Paulo",
          federal_unit: "SP",
        };
      }
    }

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

    // Download and save boleto PDF
    let boletoFilePath: string | null = null;
    if (type === "boleto" && paymentUrl) {
      boletoFilePath = await downloadAndSaveBoletoPdf(paymentUrl, userId, mpData.id);
      if (!boletoFilePath) {
        console.error(`[payment] FAILED to save boleto PDF for MP payment ${mpData.id}. Will save transaction without file.`);
      }
    }

    // Save transaction
    console.log("[payment] MP success, saving transaction...");
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        amount: Number(amount),
        type: type || "pix",
        status: STATUS_MAP[mpData.status] || "pendente",
        source: "mercadopago",
        external_id: String(mpData.id),
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: resolvedEmail || null,
        customer_document: customer_document || null,
        description: description || null,
        payment_url: paymentUrl,
        metadata: {
          mp_status: mpData.status,
          barcode,
          qr_code: qrCode,
          payment_method: mpData.payment_method_id,
          ...(boletoFilePath ? { boleto_file: boletoFilePath } : {}),
        },
        paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (txError) {
      console.error("[payment] DB insert FAILED:", JSON.stringify(txError));
      return res.status(500).json({
        error: "Cobrança criada no Mercado Pago mas falhou ao salvar no banco de dados",
        mp_id: mpData.id,
        db_error: txError.message,
      });
    }
    console.log("[payment] Transaction saved:", tx?.id);

    // Upsert conversation if phone provided
    if (customer_phone) {
      const phone = customer_phone.replace(/\D/g, "");
      const remoteJid = `${phone}@s.whatsapp.net`;

      await supabase.from("conversations").upsert(
        {
          user_id: userId,
          workspace_id: workspaceId,
          remote_jid: remoteJid,
          contact_name: customer_name,
          phone_number: phone,
          email: resolvedEmail || null,
          instance_name: null,
        },
        { onConflict: "user_id,remote_jid,instance_name" }
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
      const token = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
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

      // Fetch existing metadata to MERGE (not overwrite)
      const { data: existing } = await supabase
        .from("transactions")
        .select("metadata")
        .eq("external_id", String(paymentId))
        .eq("source", "mercadopago")
        .single();

      const existingMeta = (existing?.metadata as any) || {};

      const updateData: any = {
        status: newStatus,
        metadata: {
          ...existingMeta,
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

// ─── GET /boleto-pdf/:transactionId ─── On-demand PDF fetch/serve
router.get("/boleto-pdf/:transactionId", async (req: Request, res: Response) => {
  try {
    const supabase = getServiceClient();
    const { data: tx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", req.params.transactionId)
      .single();

    if (error || !tx) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    if (tx.type !== "boleto") {
      return res.status(400).json({ error: "Transação não é boleto" });
    }

    const meta = (tx.metadata as any) || {};

    // Check if file already exists on disk
    if (meta.boleto_file) {
      const fsPath = (meta.boleto_file as string).replace("/media/", "/media-files/");
      try {
        await fs.access(fsPath);
        // File exists, serve it
        const buffer = await fs.readFile(fsPath);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="boleto-${tx.external_id}.pdf"`);
        return res.send(buffer);
      } catch {
        // File doesn't exist on disk, try to re-download
        console.log(`[payment] boleto_file path exists in DB but not on disk: ${fsPath}`);
      }
    }

    // Try to download from payment_url
    if (!tx.payment_url) {
      return res.status(404).json({ error: "Nenhum link de pagamento disponível para este boleto" });
    }

    const savedPath = await downloadAndSaveBoletoPdf(tx.payment_url, tx.user_id, tx.external_id || tx.id);
    if (savedPath) {
      // Update metadata with the new file path
      await supabase
        .from("transactions")
        .update({ metadata: { ...meta, boleto_file: savedPath } })
        .eq("id", tx.id);

      const fsPath = savedPath.replace("/media/", "/media-files/");
      const buffer = await fs.readFile(fsPath);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="boleto-${tx.external_id}.pdf"`);
      return res.send(buffer);
    }

    return res.status(404).json({ error: "Não foi possível obter o PDF do boleto" });
  } catch (err: any) {
    console.error("[payment] boleto-pdf error:", err.message);
    return res.status(500).json({ error: err.message });
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
      const token = await getMPTokenForUser(data.user_id);
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
