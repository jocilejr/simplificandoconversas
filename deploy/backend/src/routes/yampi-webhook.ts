import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { dispatchRecovery } from "../lib/recovery-dispatch";
import { normalizePhone } from "../lib/normalize-phone";

const router = Router();

/**
 * Yampi Webhook Handler (via n8n)
 *
 * O n8n recebe os eventos da Yampi e repassa para esta rota
 * com workspace_id e user_id já definidos no body.
 *
 * Payload esperado:
 * {
 *   "event": "order.paid" | "transaction.payment.refused" | "cart.reminder",
 *   "workspace_id": "uuid",
 *   "user_id": "uuid",
 *   "resource": { ... }
 * }
 */

// Extract customer data from Yampi's nested customer object
function extractCustomer(customerData: any) {
  const c = customerData?.data || customerData || {};
  return {
    name: c.name || c.generic_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
    email: c.email || null,
    phone: normalizePhone(c.phone?.full_number),
    document: c.cpf || c.cnpj || null,
  };
}

// Determine payment type from Yampi payment alias
function mapPaymentType(paymentAlias: string | undefined): string {
  if (!paymentAlias) return "yampi";
  const alias = paymentAlias.toLowerCase();
  if (alias.includes("credit_card") || alias.includes("debit_card")) return "cartao";
  if (alias.includes("pix")) return "pix";
  if (alias.includes("billet") || alias.includes("boleto")) return "boleto";
  return "yampi";
}

// Build product description from items
function buildProductDescription(items: any[]): string {
  if (!items || items.length === 0) return "";
  return items
    .map((item: any) => {
      const name = item.sku?.data?.title || item.sku?.title || "Produto";
      const qty = item.quantity || 1;
      return qty > 1 ? `${qty}x ${name}` : name;
    })
    .join(", ");
}

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const event = body?.event;
    const resource = body?.resource;
    const workspaceId = body?.workspace_id;
    const userId = body?.user_id;

    const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    console.log(`[yampi-webhook] Incoming request — event: ${event || "none"}, ip: ${clientIp}`);

    if (!event || !resource) {
      console.log("[yampi-webhook] Missing event or resource, returning 400");
      return res.status(400).json({ error: "Missing event or resource" });
    }

    if (!workspaceId || !userId) {
      console.log("[yampi-webhook] Missing workspace_id or user_id, returning 400");
      return res.status(400).json({ error: "Missing workspace_id or user_id" });
    }

    const sb = getServiceClient();

    // ─── order.paid ───
    if (event === "order.paid") {
      const order = resource;
      const customer = extractCustomer(order.customer);
      const amount = Number(order.value_total || order.buyer_value_total || 0);
      const orderNumber = String(order.number || order.id || "");
      const externalId = `yampi_order_${orderNumber}`;

      // Payment type from first transaction
      const firstTx = order.transactions?.data?.[0];
      const paymentAlias = firstTx?.payment?.data?.alias || order.payments?.[0]?.alias;
      const type = mapPaymentType(paymentAlias);

      // Product names for description
      const items = order.items?.data || [];
      const productDesc = buildProductDescription(items);
      const description = productDesc
        ? `Pedido #${orderNumber} — ${productDesc}`
        : `Pedido Yampi #${orderNumber}`;

      // Dedup
      const { data: existing } = await sb
        .from("transactions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("external_id", externalId)
        .eq("source", "yampi")
        .maybeSingle();
      if (existing) {
        console.log(`[yampi-webhook] Duplicate order ${orderNumber}, skipping`);
        return res.status(200).json({ ok: true, skipped: "duplicate" });
      }

      await sb.from("transactions").insert({
        user_id: userId,
        workspace_id: workspaceId,
        type,
        status: "aprovado",
        source: "yampi",
        amount,
        external_id: externalId,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_document: customer.document,
        description,
        payment_url: order.public_url || null,
        paid_at: new Date().toISOString(),
        metadata: {
          yampi_event: event,
          order_number: orderNumber,
          payment_method: paymentAlias || null,
          shipment_service: order.shipment_service || null,
          value_products: order.value_products,
          value_shipment: order.value_shipment,
          value_discount: order.value_discount,
          items: items.map((i: any) => ({
            name: i.sku?.data?.title || "Produto",
            sku: i.item_sku || i.sku?.data?.sku,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      });

      console.log(`[yampi-webhook] Order #${orderNumber} saved as approved (${type})`);

    // ─── transaction.payment.refused ───
    } else if (event === "transaction.payment.refused") {
      const tx = resource;
      const customer = extractCustomer(tx.customer);
      const amount = Number(tx.amount || 0);
      const txId = String(tx.id || "");
      const externalId = `yampi_refused_${txId}`;

      const paymentAlias = tx.payment?.data?.alias;
      const type = mapPaymentType(paymentAlias);

      // Dedup
      const { data: existing } = await sb
        .from("transactions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("external_id", externalId)
        .eq("source", "yampi")
        .maybeSingle();
      if (existing) {
        console.log(`[yampi-webhook] Duplicate refused tx ${txId}, skipping`);
        return res.status(200).json({ ok: true, skipped: "duplicate" });
      }

      // Cart items for description
      const cartItems = tx.cart?.data?.items?.data || [];
      const productDesc = buildProductDescription(cartItems);

      await sb.from("transactions").insert({
        user_id: userId,
        workspace_id: workspaceId,
        type,
        status: "rejeitado",
        source: "yampi",
        amount,
        external_id: externalId,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_document: customer.document,
        description: productDesc
          ? `Pagamento recusado — ${productDesc}`
          : `Pagamento recusado Yampi`,
        payment_url: tx.cart?.data?.unauth_simulate_url || null,
        metadata: {
          yampi_event: event,
          error_message: tx.error_message || null,
          error_code: tx.error_code || null,
          payment_method: paymentAlias || null,
          transaction_id: txId,
          installments: tx.installments,
        },
      });

      console.log(`[yampi-webhook] Refused transaction ${txId} saved`);

      // Enqueue for recovery
      const refusedTxId = (await sb.from("transactions").select("id").eq("workspace_id", workspaceId).eq("external_id", externalId).eq("source", "yampi").maybeSingle()).data?.id;
      if (refusedTxId) {
        await dispatchRecovery({
          workspaceId, userId, transactionId: refusedTxId,
          customerPhone: customer.phone, customerName: customer.name,
          amount, transactionType: type,
        }).catch((e: any) => console.error("[yampi-webhook] enqueue error:", e.message));
      }

    // ─── cart.reminder ───
    } else if (event === "cart.reminder") {
      const cart = resource;
      const customer = extractCustomer(cart.customer);
      const totalizers = cart.totalizers || {};
      const amount = Number(totalizers.total || 0);
      const cartId = String(cart.id || "");
      const externalId = `yampi_cart_${cartId}`;

      // Dedup
      const { data: existing } = await sb
        .from("transactions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("external_id", externalId)
        .eq("source", "yampi")
        .maybeSingle();
      if (existing) {
        console.log(`[yampi-webhook] Duplicate cart ${cartId}, skipping`);
        return res.status(200).json({ ok: true, skipped: "duplicate" });
      }

      // Cart items for description
      const items = cart.items?.data || [];
      const productDesc = buildProductDescription(items);
      const abandonedStep = cart.search?.data?.abandoned_step || cart.spreadsheet?.data?.abandoned_step || null;

      await sb.from("transactions").insert({
        user_id: userId,
        workspace_id: workspaceId,
        type: "yampi_cart",
        status: "abandonado",
        source: "yampi",
        amount,
        external_id: externalId,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_document: customer.document,
        description: productDesc
          ? `Carrinho abandonado — ${productDesc}`
          : `Carrinho abandonado Yampi`,
        payment_url: cart.unauth_simulate_url || cart.simulate_url || null,
        metadata: {
          yampi_event: event,
          cart_token: cart.token || null,
          abandoned_step: abandonedStep,
          recovery_url: cart.unauth_simulate_url || cart.simulate_url || null,
          shipping_service: cart.shipping_service || null,
          value_products: totalizers.subtotal,
          value_shipment: totalizers.shipment,
          value_discount: totalizers.discount,
          items: items.map((i: any) => ({
            name: i.sku?.data?.title || "Produto",
            sku: i.sku?.data?.sku,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      });

      console.log(`[yampi-webhook] Cart ${cartId} saved as abandoned (step: ${abandonedStep})`);

      // Enqueue for recovery
      const cartTxId = (await sb.from("transactions").select("id").eq("workspace_id", workspaceId).eq("external_id", externalId).eq("source", "yampi").maybeSingle()).data?.id;
      if (cartTxId) {
        await dispatchRecovery({
          workspaceId, userId, transactionId: cartTxId,
          customerPhone: customer.phone, customerName: customer.name,
          amount, transactionType: "yampi_cart",
        }).catch((e: any) => console.error("[yampi-webhook] enqueue error:", e.message));
      }

    } else {
      console.log(`[yampi-webhook] Ignoring event: ${event}`);
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[yampi-webhook] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
