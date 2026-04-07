import { Router } from "express";
import crypto from "crypto";
import { getServiceClient } from "../lib/supabase";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const event = body?.event;
    const payload = body?.resource || body;

    console.log(`[yampi-webhook] Received event: ${event}`);

    if (!event) {
      return res.status(400).json({ error: "Missing event" });
    }

    // Extract store alias from payload
    const storeAlias =
      payload?.store?.alias ||
      payload?.alias ||
      body?.store?.alias ||
      null;

    const sb = getServiceClient();

    // Find workspace by yampi alias in platform_connections
    const { data: connections } = await sb
      .from("platform_connections")
      .select("*")
      .eq("platform", "yampi")
      .eq("enabled", true);

    if (!connections || connections.length === 0) {
      console.log("[yampi-webhook] No yampi connections found");
      return res.status(200).json({ ok: true, skipped: "no_connection" });
    }

    // Match by alias or use first connection
    let connection = connections.find(
      (c: any) => c.credentials?.alias && storeAlias && c.credentials.alias === storeAlias
    );
    if (!connection) {
      connection = connections[0];
    }

    const secretKey = (connection.credentials as any)?.secret_key;

    // Validate HMAC signature if secret_key is configured
    const hmacHeader = req.headers["x-yampi-hmac-sha256"] as string | undefined;
    if (secretKey && hmacHeader) {
      const rawBody = JSON.stringify(req.body);
      const computed = crypto
        .createHmac("sha256", secretKey)
        .update(rawBody)
        .digest("hex");
      if (computed !== hmacHeader) {
        console.log("[yampi-webhook] HMAC mismatch");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const userId = connection.user_id;
    const workspaceId = connection.workspace_id;

    if (event === "order.paid") {
      const order = payload;
      const customer = order?.customer || {};
      const amount = Number(order?.value_total || order?.total || 0);

      const externalId = String(order?.id || order?.number || "");

      // Check for duplicate
      if (externalId) {
        const { data: existing } = await sb
          .from("transactions")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("external_id", externalId)
          .eq("source", "yampi")
          .maybeSingle();
        if (existing) {
          console.log(`[yampi-webhook] Duplicate order ${externalId}, skipping`);
          return res.status(200).json({ ok: true, skipped: "duplicate" });
        }
      }

      await sb.from("transactions").insert({
        user_id: userId,
        workspace_id: workspaceId,
        type: "yampi",
        status: "aprovado",
        source: "yampi",
        amount,
        external_id: externalId || null,
        customer_name: customer?.name || customer?.first_name || null,
        customer_email: customer?.email || null,
        customer_phone: customer?.phone?.full_number || customer?.phone || null,
        customer_document: customer?.cpf || customer?.cnpj || null,
        description: `Pedido Yampi #${order?.number || externalId}`,
        payment_url: order?.checkout_url || null,
        paid_at: new Date().toISOString(),
        metadata: { yampi_event: event, yampi_payload: order },
      });

      console.log(`[yampi-webhook] Order ${externalId} saved as approved`);
    } else if (event === "cart.reminder") {
      const cart = payload;
      const customer = cart?.customer || {};
      const amount = Number(cart?.value_total || cart?.total || 0);
      const externalId = String(cart?.id || "");

      // Check for duplicate
      if (externalId) {
        const { data: existing } = await sb
          .from("transactions")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("external_id", `cart_${externalId}`)
          .eq("source", "yampi")
          .maybeSingle();
        if (existing) {
          console.log(`[yampi-webhook] Duplicate cart ${externalId}, skipping`);
          return res.status(200).json({ ok: true, skipped: "duplicate" });
        }
      }

      await sb.from("transactions").insert({
        user_id: userId,
        workspace_id: workspaceId,
        type: "yampi_cart",
        status: "abandonado",
        source: "yampi",
        amount,
        external_id: externalId ? `cart_${externalId}` : null,
        customer_name: customer?.name || customer?.first_name || null,
        customer_email: customer?.email || null,
        customer_phone: customer?.phone?.full_number || customer?.phone || null,
        customer_document: customer?.cpf || customer?.cnpj || null,
        description: `Carrinho abandonado Yampi`,
        payment_url: cart?.recovery_url || cart?.checkout_url || null,
        metadata: { yampi_event: event, yampi_payload: cart },
      });

      console.log(`[yampi-webhook] Cart ${externalId} saved as abandoned`);
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
