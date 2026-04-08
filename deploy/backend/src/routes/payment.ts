import { Router, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";
import { resolveWorkspaceId } from "../lib/workspace";
import { dispatchRecovery, checkWhatsAppNumber } from "../lib/recovery-dispatch";
import { normalizePhone } from "../lib/normalize-phone";
import { getRandomCep } from "../lib/random-ceps";
import { lookupCep } from "../lib/cep-lookup";
import fs from "fs/promises";
import path from "path";

const router = Router();

const MP_API = "https://api.mercadopago.com";

/** Map Mercado Pago payment_method_id to our internal transaction type */
function resolveTransactionType(paymentMethodId: string | undefined): string {
  if (!paymentMethodId) return "outro";
  const id = paymentMethodId.toLowerCase();
  if (id === "pix") return "pix";
  if (id === "bolbradesco" || id === "pec") return "boleto";
  if (["credit_card", "debit_card", "prepaid_card", "account_money"].includes(id)) return "cartao";
  return id; // preserve original for unknown methods
}

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
        headers: {
          "Accept": "application/pdf,*/*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
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
      console.log(`[payment] PDF response: status=${pdfResp.status}, content-type=${contentType}, size=${buffer.length}`);

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

      // Save failed transaction so it appears in "Carrinhos" tab
      const errorCause = mpData?.cause?.[0];
      const errorReason = errorCause
        ? `${errorCause.code || ""} - ${errorCause.description || mpData.message || "Erro desconhecido"}`.trim()
        : mpData?.message || "Erro desconhecido";

      try {
        await supabase.from("transactions").insert({
          user_id: userId,
          workspace_id: workspaceId,
          amount: Number(amount),
          type: type || "boleto",
          status: "rejeitado",
          source: "mercadopago",
          external_id: null,
          customer_name,
        customer_phone: normalizePhone(customer_phone),
        customer_email: resolvedEmail || null,
        customer_document: customer_document || null,
        description: description || null,
        payment_url: null,
        metadata: {
          error_reason: errorReason,
          mp_error: mpData,
        },
        });
        console.log(`[payment] Saved rejected transaction: ${errorReason}`);
      } catch (saveErr: any) {
        console.error("[payment] Failed to save rejected transaction:", saveErr.message);
      }

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
    // URL direta do PDF (external_resource_url retorna o arquivo real)
    const pdfDownloadUrl =
      mpData.transaction_details?.external_resource_url ||
      mpData.point_of_interaction?.transaction_data?.ticket_url ||
      "";
    const barcode =
      mpData.barcode?.content ||
      mpData.transaction_details?.digitable_line ||
      "";
    const qrCode =
      mpData.point_of_interaction?.transaction_data?.qr_code || "";
    const qrCodeBase64 =
      mpData.point_of_interaction?.transaction_data?.qr_code_base64 || "";

    // Download and save boleto PDF using direct URL
    let boletoFilePath: string | null = null;
    if (type === "boleto" && pdfDownloadUrl) {
      boletoFilePath = await downloadAndSaveBoletoPdf(pdfDownloadUrl, userId, mpData.id);
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
        customer_phone: normalizePhone(customer_phone),
        customer_email: resolvedEmail || null,
        customer_document: customer_document || null,
        description: description || null,
        payment_url: paymentUrl,
        metadata: {
          mp_status: mpData.status,
          barcode,
          qr_code: qrCode,
          payment_method: mpData.payment_method_id,
          pdf_download_url: pdfDownloadUrl || null,
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

    // Check WhatsApp number validity and save to DB
    if (tx?.id && customer_phone) {
      try {
        const phone = normalizePhone(customer_phone);
        if (phone && phone.length >= 12) {
          // Resolve instance from recovery_settings
          const { data: recSettings } = await supabase
            .from("recovery_settings")
            .select("instance_boleto, instance_pix, instance_name")
            .eq("workspace_id", workspaceId)
            .maybeSingle();

          const instanceName = type === "boleto"
            ? (recSettings as any)?.instance_boleto || (recSettings as any)?.instance_name
            : (recSettings as any)?.instance_pix || (recSettings as any)?.instance_name;

          if (instanceName) {
            const isValid = await checkWhatsAppNumber(phone, instanceName);
            if (isValid !== null) {
              await supabase.from("transactions").update({ whatsapp_valid: isValid } as any).eq("id", tx.id);
              console.log(`[payment] WhatsApp check for ${phone}: ${isValid}`);
            }
          }
        }
      } catch (waErr: any) {
        console.warn("[payment] WhatsApp check error:", waErr.message);
      }
    }

    // Auto-recovery: enqueue immediately upon transaction creation
    if (tx?.id && customer_phone) {
      try {
        await dispatchRecovery({
          workspaceId,
          userId,
          transactionId: tx.id,
          customerPhone: customer_phone,
          customerName: customer_name || null,
          amount: amount,
          transactionType: type === "boleto" ? "boleto" : "pix",
        });
      } catch (enqErr: any) {
        console.error("[payment] Recovery enqueue error:", enqErr.message);
      }
    }

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

// ─── POST /webhook/boleto ─── Dedicated Mercado Pago IPN for boletos (per-user token)
router.post("/webhook/boleto", async (req: Request, res: Response) => {
  try {
    console.log(`[boleto-webhook] Full body:`, JSON.stringify(req.body));

    // Extract payment ID — MP IPN can send as plain ID or full URL
    let rawResource = req.body?.resource || req.body?.data?.id || req.query?.id;
    const topic = req.body?.topic || req.query?.topic;

    // MP IPN may send resource as URL: https://api.mercadopago.com/v1/payments/12345
    const paymentId =
      typeof rawResource === "string" && rawResource.includes("/")
        ? rawResource.split("/").pop()
        : rawResource
          ? String(rawResource)
          : null;

    console.log(`[boleto-webhook] Received: topic=${topic}, rawResource=${rawResource}, paymentId=${paymentId}`);

    if (topic !== "payment" || !paymentId) {
      console.log(`[boleto-webhook] Ignoring non-payment topic or missing ID`);
      return res.sendStatus(200);
    }

    const supabase = getServiceClient();

    // ── Step 1: Try to find existing transaction by external_id (fast path)
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("external_id", String(paymentId))
      .eq("source", "mercadopago")
      .single();

    let token: string | null = null;
    let mpData: any = null;

    if (tx) {
      // Fast path: we know the user, get their token
      token = await getMPTokenForUser(tx.user_id);
      if (!token) {
        console.error(`[boleto-webhook] No MP token for user ${tx.user_id}`);
        return res.sendStatus(200);
      }

      const mpResp = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mpResp.ok) {
        console.error(`[boleto-webhook] MP API error: ${mpResp.status}`);
        return res.sendStatus(200);
      }

      mpData = await mpResp.json();
    } else {
      // ── Step 2: Transaction not found — iterate all MP tokens to find the payment
      console.log(`[boleto-webhook] No transaction found for external_id=${paymentId}, trying all MP tokens...`);

      const { data: allConnections } = await supabase
        .from("platform_connections")
        .select("user_id, workspace_id, credentials")
        .eq("platform", "mercadopago")
        .eq("enabled", true);

      if (!allConnections || allConnections.length === 0) {
        // Last resort: try env var token
        const envToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
        if (envToken) {
          const mpResp = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${envToken}` },
          });
          if (mpResp.ok) {
            mpData = await mpResp.json();
            token = envToken;
          }
        }
        if (!mpData) {
          console.error(`[boleto-webhook] No MP connections found and env token failed`);
          return res.sendStatus(200);
        }
      } else {
        for (const conn of allConnections) {
          const connToken = (conn.credentials as any)?.access_token;
          if (!connToken) continue;

          try {
            const mpResp = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
              headers: { Authorization: `Bearer ${connToken}` },
            });
            if (mpResp.ok) {
              mpData = await mpResp.json();
              token = connToken;
              console.log(`[boleto-webhook] Found payment via user ${conn.user_id}`);
              break;
            } else {
              console.log(`[boleto-webhook] Token for user ${conn.user_id} returned ${mpResp.status}`);
            }
          } catch (fetchErr: any) {
            console.warn(`[boleto-webhook] Fetch error for user ${conn.user_id}: ${fetchErr.message}`);
          }
        }
      }

      if (!mpData) {
        console.error(`[boleto-webhook] Could not fetch payment ${paymentId} with any available token`);
        return res.sendStatus(200);
      }
    }

    // ── Step 3: We have mpData — update or create transaction
    const newStatus = STATUS_MAP[mpData.status] || mpData.status;

    if (tx) {
      // Update existing transaction
      const oldStatus = tx.status;
      console.log(`[boleto-webhook] Payment ${paymentId}: ${oldStatus} → ${newStatus} (mp: ${mpData.status})`);

      if (newStatus === oldStatus) {
        console.log(`[boleto-webhook] Status unchanged, skipping`);
        return res.sendStatus(200);
      }

      const existingMeta = (tx.metadata as any) || {};
      const updateData: any = {
        status: newStatus,
        metadata: {
          ...existingMeta,
          mp_status: mpData.status,
          mp_status_detail: mpData.status_detail,
          payment_method: mpData.payment_method_id,
          barcode: mpData.barcode?.content || existingMeta.barcode,
          digitable_line: mpData.transaction_details?.digitable_line || existingMeta.digitable_line,
        },
      };

      if (mpData.status === "approved") {
        updateData.paid_at = mpData.date_approved || new Date().toISOString();
      }

      await supabase.from("transactions").update(updateData).eq("id", tx.id);
      console.log(`[boleto-webhook] Updated transaction ${tx.id} → ${newStatus}`);

      // Recovery queue management
      if (mpData.status === "approved") {
        const { data: deleted } = await supabase
          .from("recovery_queue")
          .delete()
          .eq("transaction_id", tx.id)
          .eq("status", "pending")
          .select("id");

        if (deleted?.length) {
          console.log(`[boleto-webhook] Removed ${deleted.length} items from recovery_queue for tx ${tx.id}`);
        }
      } else if (mpData.status === "pending" && tx.customer_phone) {
        try {
          const workspaceId = tx.workspace_id || (await resolveWorkspaceId(tx.user_id));
          await dispatchRecovery({
            workspaceId,
            userId: tx.user_id,
            transactionId: tx.id,
            customerPhone: tx.customer_phone,
            customerName: tx.customer_name,
            amount: tx.amount,
            transactionType: tx.type || resolveTransactionType(mpData.payment_method_id),
          });
        } catch (enqErr: any) {
          console.error(`[boleto-webhook] Recovery enqueue error:`, enqErr.message);
        }
      }
    } else {
      // ── Step 4: Create new transaction from MP data

      // Resolve user/workspace from the connection that matched the token
      let userId: string | null = null;
      let workspaceId: string | null = null;

      const { data: matchedConn } = await supabase
        .from("platform_connections")
        .select("user_id, workspace_id")
        .eq("platform", "mercadopago")
        .eq("enabled", true)
        .limit(10);

      if (matchedConn) {
        for (const conn of matchedConn) {
          const connToken = await getMPTokenForUser(conn.user_id);
          if (connToken === token) {
            userId = conn.user_id;
            workspaceId = conn.workspace_id;
            break;
          }
        }
        if (!userId && matchedConn.length > 0) {
          userId = matchedConn[0].user_id;
          workspaceId = matchedConn[0].workspace_id;
        }
      }

      if (!userId || !workspaceId) {
        console.error(`[boleto-webhook] Cannot determine user/workspace for new transaction`);
        return res.sendStatus(200);
      }

      const payerPhone = mpData.payer?.phone?.number
        ? String(mpData.payer.phone.area_code || "") + String(mpData.payer.phone.number)
        : null;
      const cleanPhone = normalizePhone(payerPhone);

      const paymentUrl =
        mpData.point_of_interaction?.transaction_data?.ticket_url ||
        mpData.transaction_details?.external_resource_url ||
        "";

      const metadataObj = {
        mp_status: mpData.status,
        mp_status_detail: mpData.status_detail,
        payment_method: mpData.payment_method_id,
        barcode: mpData.barcode?.content || null,
        digitable_line: mpData.transaction_details?.digitable_line || null,
        created_by_webhook: true,
      };

      // ── Approved: always create (appears in "Aprovados" tab)
      if (mpData.status === "approved") {
        console.log(`[boleto-webhook] Creating APPROVED transaction for MP payment ${paymentId}`);
        const { error: insertErr } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            workspace_id: workspaceId,
            amount: mpData.transaction_amount || 0,
            type: resolveTransactionType(mpData.payment_method_id),
            status: "aprovado",
            source: "mercadopago",
            external_id: String(mpData.id),
            customer_name: mpData.payer?.first_name
              ? `${mpData.payer.first_name} ${mpData.payer.last_name || ""}`.trim()
              : null,
            customer_email: mpData.payer?.email || null,
            customer_phone: cleanPhone,
            customer_document: mpData.payer?.identification?.number || null,
            description: mpData.description || null,
            payment_url: paymentUrl,
            metadata: metadataObj,
            paid_at: mpData.date_approved || new Date().toISOString(),
          });

        if (insertErr) {
          console.error(`[boleto-webhook] Insert approved error:`, insertErr.message);
        }
        return res.sendStatus(200);
      }

      // ── Non-pending statuses: ignore
      if (mpData.status !== "pending") {
        console.log(`[boleto-webhook] Ignoring status ${mpData.status} for unknown payment ${paymentId}`);
        return res.sendStatus(200);
      }

      // ── Pending: require 5 mandatory fields before creating
      const hasBarcode = !!(mpData.barcode?.content || mpData.transaction_details?.digitable_line);
      const hasCpf = !!mpData.payer?.identification?.number;
      const hasName = !!mpData.payer?.first_name;
      const hasPhone = !!(mpData.payer?.phone?.number);
      const hasPdf = !!(mpData.transaction_details?.external_resource_url ||
                        mpData.point_of_interaction?.transaction_data?.ticket_url);

      if (!hasBarcode || !hasCpf || !hasName || !hasPhone || !hasPdf) {
        console.log(`[boleto-webhook] Skipping pending — missing fields: barcode=${hasBarcode} cpf=${hasCpf} name=${hasName} phone=${hasPhone} pdf=${hasPdf}`);
        return res.sendStatus(200);
      }

      // Retry: wait 3s in case /create route is still processing
      await new Promise(r => setTimeout(r, 3000));
      const { data: retryTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("external_id", String(mpData.id))
        .maybeSingle();

      if (retryTx) {
        console.log(`[boleto-webhook] Transaction appeared after retry, skipping create`);
        return res.sendStatus(200);
      }

      console.log(`[boleto-webhook] Creating PENDING transaction for MP payment ${paymentId}`);
      const { data: newTx, error: insertErr } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          amount: mpData.transaction_amount || 0,
          type: resolveTransactionType(mpData.payment_method_id),
          status: "pendente",
          source: "mercadopago",
          external_id: String(mpData.id),
          customer_name: `${mpData.payer.first_name} ${mpData.payer.last_name || ""}`.trim(),
          customer_email: mpData.payer?.email || null,
          customer_phone: cleanPhone,
          customer_document: mpData.payer.identification.number,
          description: mpData.description || null,
          payment_url: paymentUrl,
          metadata: metadataObj,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(`[boleto-webhook] Insert pending error:`, insertErr.message);
        return res.sendStatus(200);
      }

      console.log(`[boleto-webhook] Created pending transaction ${newTx?.id}`);

      // Enqueue recovery
      if (newTx?.id && cleanPhone) {
        try {
          await dispatchRecovery({
            workspaceId,
            userId,
            transactionId: newTx.id,
            customerPhone: cleanPhone,
            customerName: mpData.payer?.first_name || null,
            amount: mpData.transaction_amount || 0,
            transactionType: resolveTransactionType(mpData.payment_method_id),
          });
        } catch (enqErr: any) {
          console.error(`[boleto-webhook] Recovery enqueue error:`, enqErr.message);
        }
      }
    }

    return res.sendStatus(200);
  } catch (err: any) {
    console.error(`[boleto-webhook] Error:`, err.message);
    return res.sendStatus(200);
  }
});

// ─── GET /boleto-image/:transactionId ─── Convert boleto PDF to JPG
router.get("/boleto-image/:transactionId", async (req: Request, res: Response) => {
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

    const meta = (tx.metadata as any) || {};
    if (!meta.boleto_file) {
      return res.status(404).json({ error: "PDF do boleto não encontrado" });
    }

    const fsPath = (meta.boleto_file as string).replace("/media/", "/media-files/");
    const jpgPath = fsPath.replace(/\.pdf$/i, ".jpg");

    // Check for cached JPG first
    try {
      await fs.access(jpgPath);
      const buffer = await fs.readFile(jpgPath);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buffer);
    } catch {
      // No cached JPG, convert
    }

    // Check PDF exists
    try {
      await fs.access(fsPath);
    } catch {
      return res.status(404).json({ error: "PDF do boleto não encontrado no disco" });
    }

    // Convert PDF to JPG using pdftoppm
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execPromise = promisify(exec);

    const outputPrefix = jpgPath.replace(/\.jpg$/i, "");
    try {
      await execPromise(`pdftoppm -jpeg -singlefile -r 200 "${fsPath}" "${outputPrefix}"`);
    } catch (convErr: any) {
      console.error(`[payment] pdftoppm conversion error:`, convErr.message);
      return res.status(500).json({ error: "Falha ao converter PDF para imagem" });
    }

    try {
      await fs.access(jpgPath);
      const buffer = await fs.readFile(jpgPath);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buffer);
    } catch {
      return res.status(500).json({ error: "Imagem convertida não encontrada" });
    }
  } catch (err: any) {
    console.error("[payment] boleto-image error:", err.message);
    return res.status(500).json({ error: err.message });
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

    if (!meta.boleto_file) {
      return res.status(404).json({ error: "O boleto não existe no banco de dados" });
    }

    const fsPath = (meta.boleto_file as string).replace("/media/", "/media-files/");
    try {
      await fs.access(fsPath);
      const buffer = await fs.readFile(fsPath);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="boleto-${tx.external_id}.pdf"`);
      return res.send(buffer);
    } catch {
      return res.status(404).json({ error: "O boleto não existe no banco de dados" });
    }
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
