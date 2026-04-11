import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { normalizePhone } from "../lib/normalize-phone";
import { getRandomCep } from "../lib/random-ceps";
import { lookupCep } from "../lib/cep-lookup";

const router = Router();
const MP_API = "https://api.mercadopago.com";
const OPENPIX_API = "https://api.openpix.com.br/api/openpix/v1";

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

async function resolveOwnerCredentials(workspaceId: string) {
  const sb = getServiceClient();
  const { data: ws } = await sb
    .from("workspaces")
    .select("created_by")
    .eq("id", workspaceId)
    .single();

  if (!ws) return null;
  const userId = ws.created_by;

  // Get Mercado Pago token
  const { data: mpConn } = await sb
    .from("platform_connections")
    .select("credentials")
    .eq("user_id", userId)
    .eq("platform", "mercadopago")
    .eq("enabled", true)
    .maybeSingle();
  const mpToken = (mpConn?.credentials as any)?.access_token || process.env.MERCADOPAGO_ACCESS_TOKEN || "";

  // Get OpenPix app_id
  const { data: opConn } = await sb
    .from("platform_connections")
    .select("credentials")
    .eq("user_id", userId)
    .eq("platform", "openpix")
    .eq("enabled", true)
    .maybeSingle();
  const openpixAppId = (opConn?.credentials as any)?.app_id || "";

  return { userId, mpToken, openpixAppId };
}

// POST / — Create REAL charge from member area (no auth required)
router.post("/", async (req, res) => {
  try {
    const { phone, offer_name, payment_method, amount, workspace_id, customer_name, customer_document } = req.body;

    if (!phone || !offer_name || !payment_method || !workspace_id) {
      return res.status(400).json({ error: "Missing required fields: phone, offer_name, payment_method, workspace_id" });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valor inválido" });
    }

    const creds = await resolveOwnerCredentials(workspace_id);
    if (!creds) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const normalizedPhone = normalizePhone(phone) || phone.replace(/\D/g, "");
    const sb = getServiceClient();

    // Resolve email from conversations
    const FALLBACK_EMAIL = "businessvivaorigem@gmail.com";
    let resolvedEmail = FALLBACK_EMAIL;
    if (normalizedPhone) {
      const { data: conv } = await sb
        .from("conversations")
        .select("email")
        .eq("user_id", creds.userId)
        .eq("phone_number", normalizedPhone)
        .not("email", "is", null)
        .limit(1)
        .maybeSingle();
      if (conv?.email) resolvedEmail = conv.email;
    }

    const description = `Oferta: ${offer_name}`;

    // ─── PIX via OpenPix ───
    if (payment_method === "pix") {
      if (!creds.openpixAppId) {
        return res.status(500).json({ error: "OpenPix não configurado. Configure na aba Integrações." });
      }

      const correlationID = `${creds.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const valueCents = Math.round(Number(amount) * 100);

      const chargeBody: any = {
        correlationID,
        value: valueCents,
        comment: description,
        customer: {
          name: customer_name || "Cliente",
          ...(normalizedPhone ? { phone: normalizedPhone } : {}),
          ...(customer_document ? { taxID: { taxID: customer_document.replace(/\D/g, ""), type: "CPF" } } : {}),
        },
      };

      console.log("[member-purchase] Creating OpenPix charge:", JSON.stringify(chargeBody));

      const opResp = await fetch(`${OPENPIX_API}/charge`, {
        method: "POST",
        headers: { Authorization: creds.openpixAppId, "Content-Type": "application/json" },
        body: JSON.stringify(chargeBody),
      });

      const opData: any = await opResp.json();
      if (!opResp.ok) {
        console.error("[member-purchase] OpenPix error:", JSON.stringify(opData));
        return res.status(opResp.status).json({ error: "Erro ao criar cobrança PIX", details: opData });
      }

      const charge = opData.charge || {};
      const paymentUrl = charge.paymentLinkUrl || "";
      const qrCodeImage = charge.qrCodeImage || "";
      const brCode = charge.brCode || "";

      const { data: tx, error: txError } = await sb
        .from("transactions")
        .insert({
          user_id: creds.userId,
          workspace_id,
          amount: Number(amount),
          type: "pix",
          status: "pendente",
          source: "openpix",
          external_id: correlationID,
          customer_name: customer_name || null,
          customer_phone: normalizedPhone,
          customer_email: resolvedEmail,
          customer_document: customer_document || null,
          description,
          payment_url: paymentUrl,
          metadata: {
            openpix_charge_id: charge.id || null,
            correlation_id: correlationID,
            br_code: brCode,
            origin: "member-area",
          },
        })
        .select("id")
        .single();

      if (txError) {
        console.error("[member-purchase] DB insert error:", txError.message);
      }

      console.log(`[member-purchase] ✅ PIX charge created: ${tx?.id} (${correlationID})`);
      return res.json({
        success: true,
        transaction_id: tx?.id,
        payment_url: paymentUrl,
        qr_code: brCode,
        qr_code_base64: qrCodeImage,
        type: "pix",
      });
    }

    // ─── Boleto via Mercado Pago ───
    if (payment_method === "boleto") {
      if (!creds.mpToken) {
        return res.status(500).json({ error: "Mercado Pago não configurado. Configure na aba Integrações." });
      }
      if (!customer_name) {
        return res.status(400).json({ error: "Nome do cliente é obrigatório para boleto" });
      }

      const paymentBody: any = {
        transaction_amount: Number(amount),
        description,
        payment_method_id: "bolbradesco",
        payer: {
          email: resolvedEmail,
          first_name: customer_name.split(" ")[0],
          last_name: customer_name.split(" ").slice(1).join(" ") || ".",
          identification: customer_document
            ? { type: "CPF", number: customer_document.replace(/\D/g, "") }
            : undefined,
        },
      };

      // Random address for boleto
      try {
        const cep = getRandomCep();
        const addr = await lookupCep(cep);
        paymentBody.payer.address = addr;
      } catch {
        paymentBody.payer.address = {
          zip_code: "01001000",
          street_name: "Praça da Sé",
          street_number: "s/n",
          neighborhood: "Sé",
          city: "São Paulo",
          federal_unit: "SP",
        };
      }

      console.log("[member-purchase] Creating MP boleto...");

      const mpResp = await fetch(`${MP_API}/v1/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.mpToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `member-${workspace_id}-${Date.now()}`,
        },
        body: JSON.stringify(paymentBody),
      });

      const mpData: any = await mpResp.json();
      if (!mpResp.ok) {
        console.error("[member-purchase] MP error:", JSON.stringify(mpData));
        return res.status(mpResp.status).json({ error: "Erro ao criar boleto", details: mpData });
      }

      const paymentUrl =
        mpData.point_of_interaction?.transaction_data?.ticket_url ||
        mpData.transaction_details?.external_resource_url || "";
      const barcode =
        mpData.barcode?.content ||
        mpData.transaction_details?.digitable_line || "";

      const { data: tx, error: txError } = await sb
        .from("transactions")
        .insert({
          user_id: creds.userId,
          workspace_id,
          amount: Number(amount),
          type: "boleto",
          status: STATUS_MAP[mpData.status] || "pendente",
          source: "mercadopago",
          external_id: String(mpData.id),
          customer_name,
          customer_phone: normalizedPhone,
          customer_email: resolvedEmail,
          customer_document: customer_document || null,
          description,
          payment_url: paymentUrl,
          metadata: {
            mp_status: mpData.status,
            barcode,
            payment_method: mpData.payment_method_id,
            origin: "member-area",
          },
          paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (txError) {
        console.error("[member-purchase] DB insert error:", txError.message);
      }

      console.log(`[member-purchase] ✅ Boleto created: ${tx?.id} (MP ${mpData.id})`);
      return res.json({
        success: true,
        transaction_id: tx?.id,
        payment_url: paymentUrl,
        barcode,
        mp_id: mpData.id,
        status: STATUS_MAP[mpData.status] || "pendente",
        type: "boleto",
      });
    }

    // ─── Cartão: just log intent (external URL) ───
    if (payment_method === "cartao") {
      const { data: tx } = await sb
        .from("transactions")
        .insert({
          user_id: creds.userId,
          workspace_id,
          type: "cartao",
          status: "pendente",
          amount: amount || 0,
          customer_phone: normalizedPhone,
          customer_name: customer_name || null,
          customer_document: customer_document || null,
          description,
          source: "member-area",
        })
        .select("id")
        .single();

      console.log(`[member-purchase] ✅ Card intent logged: ${tx?.id}`);
      return res.json({ success: true, transaction_id: tx?.id, type: "cartao" });
    }

    return res.status(400).json({ error: `payment_method "${payment_method}" não suportado` });
  } catch (err: any) {
    console.error("[member-purchase] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /customer-info — Lookup existing customer data by phone
// Searches: 1) transactions (exact + fuzzy), 2) conversations (contact_name)
router.get("/customer-info", async (req, res) => {
  try {
    const { phone, workspace_id } = req.query;
    if (!phone || !workspace_id) {
      return res.status(400).json({ error: "phone and workspace_id required" });
    }

    const normalizedPhone = (phone as string).replace(/\D/g, "");
    const last8 = normalizedPhone.slice(-8);
    const sb = getServiceClient();

    let name = "";
    let document = "";

    // Generate phone variations for matching
    const phoneVariants = [normalizedPhone];
    if (normalizedPhone.startsWith("55") && normalizedPhone.length === 13) {
      phoneVariants.push(normalizedPhone.slice(0, 4) + normalizedPhone.slice(5));
      phoneVariants.push(normalizedPhone.slice(2));
      phoneVariants.push(normalizedPhone.slice(2, 4) + normalizedPhone.slice(5));
    } else if (normalizedPhone.startsWith("55") && normalizedPhone.length === 12) {
      phoneVariants.push(normalizedPhone.slice(0, 4) + "9" + normalizedPhone.slice(4));
      phoneVariants.push(normalizedPhone.slice(2));
      phoneVariants.push("9" + normalizedPhone.slice(4));
    } else if (normalizedPhone.length === 11) {
      phoneVariants.push("55" + normalizedPhone);
      phoneVariants.push(normalizedPhone.slice(0, 2) + normalizedPhone.slice(3));
      phoneVariants.push("55" + normalizedPhone.slice(0, 2) + normalizedPhone.slice(3));
    } else if (normalizedPhone.length === 10) {
      phoneVariants.push("55" + normalizedPhone);
      phoneVariants.push(normalizedPhone.slice(0, 2) + "9" + normalizedPhone.slice(2));
      phoneVariants.push("55" + normalizedPhone.slice(0, 2) + "9" + normalizedPhone.slice(2));
    }
    const uniqueVariants = [...new Set(phoneVariants)];

    // 1) Search transactions — exact phone match
    if (!name) {
      const { data: exactTx } = await sb
        .from("transactions")
        .select("customer_name, customer_document")
        .eq("workspace_id", workspace_id)
        .eq("customer_phone", normalizedPhone)
        .not("customer_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (exactTx?.[0]?.customer_name) {
        name = exactTx[0].customer_name;
        document = exactTx[0].customer_document || "";
      }
    }

    // 2) Fuzzy match by last 8 digits
    if (!name) {
      const { data: fuzzyTx } = await sb
        .from("transactions")
        .select("customer_name, customer_document, customer_phone")
        .eq("workspace_id", workspace_id)
        .not("customer_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (fuzzyTx) {
        const match = fuzzyTx.find((t: any) => t.customer_phone?.slice(-8) === last8);
        if (match?.customer_name) {
          name = match.customer_name;
          document = match.customer_document || "";
        }
      }
    }

    // 3) conversations.contact_name
    if (!name) {
      const jidVariants = uniqueVariants.map(v => `${v}@s.whatsapp.net`);
      const { data: convos } = await sb
        .from("conversations")
        .select("contact_name, remote_jid")
        .eq("workspace_id", workspace_id)
        .in("remote_jid", jidVariants)
        .not("contact_name", "is", null)
        .limit(1);

      if (convos?.[0]?.contact_name) {
        name = convos[0].contact_name;
      }

      if (!name) {
        const { data: allConvos } = await sb
          .from("conversations")
          .select("contact_name, remote_jid")
          .eq("workspace_id", workspace_id)
          .not("contact_name", "is", null)
          .order("last_message_at", { ascending: false })
          .limit(300);

        if (allConvos) {
          const match = allConvos.find((c: any) => {
            const cPhone = c.remote_jid?.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            return cPhone?.slice(-8) === last8;
          });
          if (match?.contact_name) {
            name = match.contact_name;
          }
        }
      }
    }

    // 4) Find document if we have name but no document
    if (name && !document) {
      const { data: docSearch } = await sb
        .from("transactions")
        .select("customer_document, customer_phone")
        .eq("workspace_id", workspace_id)
        .not("customer_document", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (docSearch) {
        const match = docSearch.find((t: any) => t.customer_phone?.slice(-8) === last8);
        if (match?.customer_document) {
          document = match.customer_document;
        }
      }
    }

    console.log(`[member-purchase] customer-info for ${normalizedPhone}: name="${name}", doc="${document ? "***" : ""}"`)
    return res.json({ name, document });
  } catch (err: any) {
    console.error("[member-purchase] customer-info error:", err.message);
    return res.json({ name: "", document: "" });
  }
});

export default router;
