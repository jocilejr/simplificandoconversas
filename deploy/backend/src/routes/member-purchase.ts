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

    const sb = getSupabase();

    // Resolve user_id from workspace
    const { data: ws } = await sb
      .from("workspaces")
      .select("created_by")
      .eq("id", workspace_id)
      .single();

    if (!ws) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const normalizedPhone = phone.replace(/\D/g, "");

    // Map payment_method to transaction type
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
router.get("/customer-info", async (req, res) => {
  try {
    const { phone, workspace_id } = req.query;
    if (!phone || !workspace_id) {
      return res.status(400).json({ error: "phone and workspace_id required" });
    }

    const normalizedPhone = (phone as string).replace(/\D/g, "");
    const sb = getSupabase();

    // Try exact match first, then last 8 digits
    const { data: exact } = await sb
      .from("transactions")
      .select("customer_name, customer_document")
      .eq("workspace_id", workspace_id)
      .eq("customer_phone", normalizedPhone)
      .not("customer_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (exact && exact.length > 0 && exact[0].customer_name) {
      return res.json({ name: exact[0].customer_name, document: exact[0].customer_document || "" });
    }

    // Try last 8 digits
    const last8 = normalizedPhone.slice(-8);
    const { data: fuzzy } = await sb
      .from("transactions")
      .select("customer_name, customer_document, customer_phone")
      .eq("workspace_id", workspace_id)
      .not("customer_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (fuzzy) {
      const match = fuzzy.find((t: any) => t.customer_phone && t.customer_phone.slice(-8) === last8);
      if (match && match.customer_name) {
        return res.json({ name: match.customer_name, document: match.customer_document || "" });
      }
    }

    return res.json({ name: "", document: "" });
  } catch (err: any) {
    console.error("[member-purchase] customer-info error:", err.message);
    return res.json({ name: "", document: "" });
  }
});

export default router;
