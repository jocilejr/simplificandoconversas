import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

/**
 * POST /api/external-messaging-webhook
 * 
 * Receives callbacks from the external financial management platform.
 * Authenticated via X-API-Key (same as platform API).
 * 
 * Expected payload:
 * {
 *   event: "payment_confirmed" | "payment_failed" | "payment_refunded" | "customer_updated" | "invoice_created",
 *   reference_id?: string,       // maps to transactions.external_id
 *   external_id?: string,        // alternative to reference_id
 *   phone?: string,              // customer phone
 *   status?: string,             // new status
 *   paid_at?: string,            // ISO date
 *   amount?: number,
 *   customer_name?: string,
 *   customer_email?: string,
 *   customer_document?: string,
 *   metadata?: object,           // any extra data
 *   tags_add?: string[],         // tags to add to the contact
 *   tags_remove?: string[],      // tags to remove from the contact
 *   message?: string,            // optional message to send (requires active instance)
 * }
 */
router.post("/", async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey || apiKey.length < 32) {
    return res.status(401).json({ error: "Missing or invalid X-API-Key header" });
  }

  const sb = getServiceClient();
  const { data: conn } = await sb
    .from("platform_connections")
    .select("user_id, enabled")
    .eq("platform", "custom_api")
    .eq("credentials->>api_key", apiKey)
    .maybeSingle();

  if (!conn) return res.status(401).json({ error: "Invalid API key" });
  if (!conn.enabled) return res.status(403).json({ error: "API key is disabled" });

  const userId = conn.user_id;
  const {
    event,
    reference_id,
    external_id,
    phone,
    status,
    paid_at,
    amount,
    customer_name,
    customer_email,
    customer_document,
    metadata,
    tags_add,
    tags_remove,
    message,
  } = req.body;

  if (!event) {
    return res.status(400).json({ error: "event is required" });
  }

  const results: any = { event, actions: [] };
  const refId = reference_id || external_id;
  const cleanedPhone = phone ? phone.replace(/\D/g, "") : null;
  const remoteJid = cleanedPhone ? `${cleanedPhone}@s.whatsapp.net` : null;

  try {
    // ── 1. Update transaction if reference_id provided ──
    if (refId && (status || paid_at || metadata)) {
      const updates: any = {};
      if (status) updates.status = status;
      if (paid_at) updates.paid_at = paid_at;
      if (metadata) updates.metadata = metadata;
      if (customer_name) updates.customer_name = customer_name;
      if (customer_email) updates.customer_email = customer_email;
      if (customer_document) updates.customer_document = customer_document;
      if (amount !== undefined) updates.amount = Number(amount);

      const { data: tx, error: txErr } = await sb
        .from("transactions")
        .update(updates)
        .eq("external_id", refId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (tx) {
        results.actions.push({ type: "transaction_updated", id: tx.id });
      } else if (!txErr && cleanedPhone) {
        // Transaction doesn't exist yet — create it
        const { data: newTx } = await sb
          .from("transactions")
          .insert({
            user_id: userId,
            external_id: refId,
            amount: amount !== undefined ? Number(amount) : 0,
            status: status || "pendente",
            paid_at: paid_at || null,
            customer_phone: cleanedPhone,
            customer_name: customer_name || null,
            customer_email: customer_email || null,
            customer_document: customer_document || null,
            source: "webhook",
            type: "pix",
            metadata: metadata || null,
          })
          .select("id")
          .single();

        if (newTx) {
          results.actions.push({ type: "transaction_created", id: newTx.id });
        }
      }
    }

    // ── 2. Update contact info ──
    if (remoteJid && customer_name) {
      const { data: conv } = await sb
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .eq("remote_jid", remoteJid)
        .maybeSingle();

      if (conv) {
        await sb
          .from("conversations")
          .update({ contact_name: customer_name })
          .eq("id", conv.id);
        results.actions.push({ type: "contact_updated" });
      }
    }

    // ── 3. Add tags ──
    if (remoteJid && tags_add && Array.isArray(tags_add) && tags_add.length > 0) {
      for (const tag of tags_add.slice(0, 20)) {
        const tagName = String(tag).trim().substring(0, 100);
        if (!tagName) continue;

        const { data: existing } = await sb
          .from("contact_tags")
          .select("id")
          .eq("user_id", userId)
          .eq("remote_jid", remoteJid)
          .eq("tag_name", tagName)
          .maybeSingle();

        if (!existing) {
          await sb.from("contact_tags").insert({
            user_id: userId,
            remote_jid: remoteJid,
            tag_name: tagName,
          });
        }
      }
      results.actions.push({ type: "tags_added", tags: tags_add });
    }

    // ── 4. Remove tags ──
    if (remoteJid && tags_remove && Array.isArray(tags_remove) && tags_remove.length > 0) {
      for (const tag of tags_remove.slice(0, 20)) {
        const tagName = String(tag).trim();
        if (!tagName) continue;

        await sb
          .from("contact_tags")
          .delete()
          .eq("user_id", userId)
          .eq("remote_jid", remoteJid)
          .eq("tag_name", tagName);
      }
      results.actions.push({ type: "tags_removed", tags: tags_remove });
    }

    // ── 5. Send WhatsApp message if provided ──
    if (remoteJid && message && cleanedPhone) {
      const { data: instances } = await sb
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1);

      if (instances && instances.length > 0) {
        const EVOLUTION_URL = process.env.EVOLUTION_URL || "http://evolution:8080";
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

        try {
          const sendResult = await fetch(
            `${EVOLUTION_URL}/message/sendText/${encodeURIComponent(instances[0].instance_name)}`,
            {
              method: "POST",
              headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ number: cleanedPhone, text: message }),
            }
          );
          const sendData: any = await sendResult.json();
          results.actions.push({ type: "message_sent", message_id: sendData?.key?.id || null });
        } catch (msgErr: any) {
          results.actions.push({ type: "message_failed", error: msgErr.message });
        }
      } else {
        results.actions.push({ type: "message_skipped", reason: "no_active_instance" });
      }
    }

    console.log(`[external-webhook] ${event} from user ${userId}:`, JSON.stringify(results.actions));
    res.json({ ok: true, ...results });
  } catch (err: any) {
    console.error("[external-webhook] error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
