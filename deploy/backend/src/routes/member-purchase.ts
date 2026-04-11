import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

// POST / — Create transaction for any payment method from member area
router.post("/", async (req, res) => {
  try {
    const { phone, offer_name, payment_method, amount, workspace_id, customer_name, customer_document } = req.body;

    if (!phone || !offer_name || !payment_method || !workspace_id) {
      return res.status(400).json({ error: "Missing required fields: phone, offer_name, payment_method, workspace_id" });
    }

    const sb = getServiceClient();

    const { data: ws } = await sb
      .from("workspaces")
      .select("created_by")
      .eq("id", workspace_id)
      .single();

    if (!ws) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const normalizedPhone = phone.replace(/\D/g, "");

    const typeMap: Record<string, string> = { pix: "pix", cartao: "cartao", boleto: "boleto" };
    const txType = typeMap[payment_method] || payment_method;

    const insertData: any = {
      user_id: ws.created_by,
      workspace_id,
      type: txType,
      status: "pendente",
      amount: amount || 0,
      customer_phone: normalizedPhone,
      description: `Oferta: ${offer_name}`,
      source: "member-area",
    };

    if (customer_name) insertData.customer_name = customer_name;
    if (customer_document) insertData.customer_document = customer_document;

    const { data: tx, error } = await sb
      .from("transactions")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      console.error("[member-purchase] Insert error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[member-purchase] ✅ Transaction created: ${tx.id} (${txType}, ${normalizedPhone}, R$${amount})`);
    return res.json({ success: true, transaction_id: tx.id });
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
      // Remove 9th digit: 55 + 2-digit DDD + 9 + 8 digits → 55 + DDD + 8 digits
      phoneVariants.push(normalizedPhone.slice(0, 4) + normalizedPhone.slice(5));
      // Without country code
      phoneVariants.push(normalizedPhone.slice(2));
      phoneVariants.push(normalizedPhone.slice(2, 4) + normalizedPhone.slice(5));
    } else if (normalizedPhone.startsWith("55") && normalizedPhone.length === 12) {
      // Add 9th digit
      phoneVariants.push(normalizedPhone.slice(0, 4) + "9" + normalizedPhone.slice(4));
      phoneVariants.push(normalizedPhone.slice(2));
      phoneVariants.push("9" + normalizedPhone.slice(4));
    } else if (normalizedPhone.length === 11) {
      phoneVariants.push("55" + normalizedPhone);
      // Remove 9th digit
      phoneVariants.push(normalizedPhone.slice(0, 2) + normalizedPhone.slice(3));
      phoneVariants.push("55" + normalizedPhone.slice(0, 2) + normalizedPhone.slice(3));
    } else if (normalizedPhone.length === 10) {
      phoneVariants.push("55" + normalizedPhone);
      phoneVariants.push(normalizedPhone.slice(0, 2) + "9" + normalizedPhone.slice(2));
      phoneVariants.push("55" + normalizedPhone.slice(0, 2) + "9" + normalizedPhone.slice(2));
    }
    const uniqueVariants = [...new Set(phoneVariants)];

    // Step 0: removed — customers table does not exist on VPS

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

    // 2) If no name yet, try transactions with last 8 digits
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

    // 3) If still no name, search conversations (contact_name) by remote_jid
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

      // Last resort: fuzzy match conversations by last 8 digits
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

    // 4) If we have name but no document, try finding document from any transaction with this phone
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
