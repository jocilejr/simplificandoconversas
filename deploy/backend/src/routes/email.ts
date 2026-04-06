import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── helpers ────────────────────────────────────────────────────────────────

async function getSmtpConfig(userId: string, smtpConfigId?: string) {
  let q = supabase.from("smtp_config").select("*").eq("user_id", userId);
  if (smtpConfigId) {
    q = q.eq("id", smtpConfigId);
  }
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error("Erro ao buscar config SMTP: " + error.message);
  if (!data || !data.host || !data.username)
    throw new Error("SMTP não configurado. Configure em Configurações > Aplicação.");
  return data;
}

function createTransporter(config: any) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port || 465,
    secure: (config.port || 465) === 465,
    auth: { user: config.username, pass: config.password },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Replace {{nome}}, {{email}}, {{telefone}} in HTML */
function replaceVariables(html: string, vars: Record<string, string | null>) {
  return html
    .replace(/\{\{nome\}\}/gi, vars.nome || "")
    .replace(/\{\{email\}\}/gi, vars.email || "")
    .replace(/\{\{telefone\}\}/gi, vars.telefone || "");
}

/** Check if email is suppressed */
async function isSuppressed(userId: string, email: string): Promise<boolean> {
  const { data } = await supabase
    .from("email_suppressions")
    .select("id")
    .eq("user_id", userId)
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data;
}

/** Log an email event */
async function logEvent(
  sendId: string,
  userId: string,
  eventType: string,
  metadata?: Record<string, any>
) {
  await supabase.from("email_events").insert({
    send_id: sendId,
    user_id: userId,
    event_type: eventType,
    metadata: metadata || {},
  });
}

/** Inject tracking pixel into HTML */
function injectTrackingPixel(html: string, sendId: string, baseUrl: string): string {
  const pixel = `<img src="${baseUrl}/functions/v1/email/track/${sendId}" width="1" height="1" style="display:none" alt="" />`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}

// ─── POST /api/email/send — single email ────────────────────────────────────

router.post("/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, html, userId, templateId, recipientName, smtpConfigId } = req.body;
    if (!to || !subject || !html || !userId) {
      return res.status(400).json({ error: "Campos obrigatórios: to, subject, html, userId" });
    }

    if (await isSuppressed(userId, to)) {
      return res.status(400).json({ error: "E-mail suprimido (bounce/unsubscribe)" });
    }

    const smtpConfig = await getSmtpConfig(userId, smtpConfigId);
    const transporter = createTransporter(smtpConfig);

    const { data: sendLog } = await supabase
      .from("email_sends")
      .insert({
        user_id: userId,
        template_id: templateId || null,
        recipient_email: to,
        recipient_name: recipientName || null,
        status: "pending",
      })
      .select()
      .single();

    const appUrl = process.env.APP_PUBLIC_URL || supabaseUrl;
    const finalHtml = sendLog ? injectTrackingPixel(html, sendLog.id, appUrl) : html;

    try {
      await transporter.sendMail({
        from: smtpConfig.from_name
          ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
          : smtpConfig.from_email,
        to,
        subject,
        html: finalHtml,
      });

      if (sendLog) {
        await supabase.from("email_sends").update({ status: "sent" }).eq("id", sendLog.id);
        await logEvent(sendLog.id, userId, "sent");
      }
      res.json({ ok: true, sendId: sendLog?.id });
    } catch (sendErr: any) {
      if (sendLog) {
        await supabase
          .from("email_sends")
          .update({ status: "failed", error_message: sendErr.message })
          .eq("id", sendLog.id);
        await logEvent(sendLog.id, userId, "failed", { error: sendErr.message });
      }
      throw sendErr;
    }
  } catch (err: any) {
    console.error("[email/send]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/email/campaign — bulk send ───────────────────────────────────

router.post("/campaign", async (req: Request, res: Response) => {
  try {
    const { campaignId, userId } = req.body;
    if (!campaignId || !userId)
      return res.status(400).json({ error: "Campos obrigatórios: campaignId, userId" });

    const { data: campaign, error: campErr } = await supabase
      .from("email_campaigns")
      .select("*, email_templates(*)")
      .eq("id", campaignId)
      .eq("user_id", userId)
      .single();
    if (campErr || !campaign) return res.status(404).json({ error: "Campanha não encontrada" });
    if (!campaign.email_templates) return res.status(400).json({ error: "Template não encontrado" });

    const template = campaign.email_templates as any;
    const smtpConfig = await getSmtpConfig(userId, campaign.smtp_config_id || undefined);
    const transporter = createTransporter(smtpConfig);

    await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);

    // Get recipients
    let recipients: { email: string; name: string | null; phone: string | null }[] = [];

    const getConversations = async (jids?: string[]) => {
      let q = supabase
        .from("conversations")
        .select("email, contact_name, phone_number")
        .eq("user_id", userId)
        .not("email", "is", null);
      if (jids) q = q.in("remote_jid", jids);
      const { data } = await q;
      return (data || [])
        .filter((c: any) => c.email && c.email.trim())
        .map((c: any) => ({ email: c.email, name: c.contact_name, phone: c.phone_number }));
    };

    if (campaign.tag_filter) {
      const { data: tagged } = await supabase
        .from("contact_tags")
        .select("remote_jid")
        .eq("user_id", userId)
        .eq("tag_name", campaign.tag_filter);
      if (tagged && tagged.length > 0) {
        recipients = await getConversations(tagged.map((t: any) => t.remote_jid));
      }
    } else {
      recipients = await getConversations();
    }

    // Merge email_contacts table
    const { data: emailContacts } = await supabase
      .from("email_contacts")
      .select("email, name")
      .eq("user_id", userId)
      .eq("status", "active");

    if (emailContacts && emailContacts.length > 0) {
      const existingEmails = new Set(recipients.map((r) => r.email.toLowerCase()));
      for (const ec of emailContacts) {
        if (!existingEmails.has(ec.email.toLowerCase())) {
          recipients.push({ email: ec.email, name: ec.name, phone: null });
          existingEmails.add(ec.email.toLowerCase());
        }
      }
    }

    // Filter suppressed
    const validRecipients: typeof recipients = [];
    for (const r of recipients) {
      if (!(await isSuppressed(userId, r.email))) validRecipients.push(r);
    }

    await supabase
      .from("email_campaigns")
      .update({ total_recipients: validRecipients.length })
      .eq("id", campaignId);

    res.json({ ok: true, totalRecipients: validRecipients.length });

    // Background sending
    let sentCount = 0;
    let failedCount = 0;
    const fromAddress = smtpConfig.from_name
      ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
      : smtpConfig.from_email;
    const appUrl = process.env.APP_PUBLIC_URL || supabaseUrl;

    for (const recipient of validRecipients) {
      const personalizedHtml = replaceVariables(template.html_body, {
        nome: recipient.name,
        email: recipient.email,
        telefone: recipient.phone,
      });

      const personalizedSubject = replaceVariables(template.subject, {
        nome: recipient.name,
        email: recipient.email,
        telefone: recipient.phone,
      });

      const { data: sendLog } = await supabase
        .from("email_sends")
        .insert({
          user_id: userId,
          campaign_id: campaignId,
          template_id: template.id,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          status: "pending",
        })
        .select()
        .single();

      const finalHtml = sendLog
        ? injectTrackingPixel(personalizedHtml, sendLog.id, appUrl)
        : personalizedHtml;

      try {
        await transporter.sendMail({ from: fromAddress, to: recipient.email, subject: personalizedSubject, html: finalHtml });
        sentCount++;
        if (sendLog) {
          await supabase.from("email_sends").update({ status: "sent" }).eq("id", sendLog.id);
          await logEvent(sendLog.id, userId, "sent");
        }
      } catch (sendErr: any) {
        failedCount++;
        if (sendLog) {
          await supabase
            .from("email_sends")
            .update({ status: "failed", error_message: sendErr.message })
            .eq("id", sendLog.id);
          await logEvent(sendLog.id, userId, "failed", { error: sendErr.message });
        }
        console.error(`[email/campaign] Falha para ${recipient.email}:`, sendErr.message);
      }

      await supabase
        .from("email_campaigns")
        .update({ sent_count: sentCount, failed_count: failedCount })
        .eq("id", campaignId);

      await sleep(3000);
    }

    // Schedule follow-ups
    const { data: followUps } = await supabase
      .from("email_follow_ups")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });

    if (followUps && followUps.length > 0) {
      for (const fu of followUps) {
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + fu.delay_days);

        const inserts = validRecipients.map((r) => ({
          follow_up_id: fu.id,
          user_id: userId,
          recipient_email: r.email,
          status: "pending",
          scheduled_at: scheduledAt.toISOString(),
        }));

        await supabase.from("email_follow_up_sends").insert(inserts);
      }
    }

    await supabase
      .from("email_campaigns")
      .update({
        status: failedCount === validRecipients.length && validRecipients.length > 0 ? "failed" : "sent",
        sent_count: sentCount,
        failed_count: failedCount,
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    console.log(
      `[email/campaign] Campanha ${campaignId} finalizada: ${sentCount} enviados, ${failedCount} falhas`
    );
  } catch (err: any) {
    console.error("[email/campaign]", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/email/test — send test email ─────────────────────────────────

router.post("/test", async (req: Request, res: Response) => {
  try {
    const { userId, smtpConfigId, host, port, username, password, from_email, from_name } = req.body;
    if (!userId) return res.status(400).json({ error: "userId obrigatório" });

    let smtpConfig: any;
    if (host && username && password && from_email) {
      // Inline credentials — test without saving
      smtpConfig = { host, port: port || 465, username, password, from_email, from_name: from_name || "" };
    } else {
      smtpConfig = await getSmtpConfig(userId, smtpConfigId);
    }

    const transporter = createTransporter(smtpConfig);

    await transporter.sendMail({
      from: smtpConfig.from_name
        ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
        : smtpConfig.from_email,
      to: smtpConfig.from_email,
      subject: "Teste SMTP - Configuração",
      html: "<h2>Teste de configuração SMTP</h2><p>Se você recebeu este e-mail, a configuração está correta!</p>",
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[email/test]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/email/verify-smtp — verify SMTP connection without sending ───

router.post("/verify-smtp", async (req: Request, res: Response) => {
  try {
    const { userId, smtpConfigId, host, port, username, password, from_email, from_name } = req.body;
    if (!userId) return res.status(400).json({ error: "userId obrigatório" });

    let smtpConfig: any;
    if (host && username && password) {
      // Inline credentials — verify without saving
      smtpConfig = { host, port: port || 465, username, password, from_email: from_email || "", from_name: from_name || "" };
    } else {
      smtpConfig = await getSmtpConfig(userId, smtpConfigId);
    }

    const transporter = createTransporter(smtpConfig);

    await transporter.verify();
    res.json({ ok: true, message: "Conexão SMTP verificada com sucesso!" });
  } catch (err: any) {
    console.error("[email/verify-smtp]", err.message);
    res.status(500).json({ error: err.message, ok: false });
  }
});

// ─── POST /api/email/preview — send preview to sender email ─────────────────

router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { userId, subject, html, smtpConfigId } = req.body;
    if (!userId || !html) return res.status(400).json({ error: "userId e html obrigatórios" });

    const smtpConfig = await getSmtpConfig(userId, smtpConfigId);
    const transporter = createTransporter(smtpConfig);

    await transporter.sendMail({
      from: smtpConfig.from_name
        ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
        : smtpConfig.from_email,
      to: smtpConfig.from_email,
      subject: `[PREVIEW] ${subject || "Sem assunto"}`,
      html,
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[email/preview]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/email/track/:sendId — tracking pixel ─────────────────────────

router.get("/track/:sendId", async (req: Request, res: Response) => {
  try {
    const { sendId } = req.params;

    // Update opened_at
    await supabase
      .from("email_sends")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", sendId)
      .is("opened_at", null);

    // Get user_id from the send
    const { data: send } = await supabase
      .from("email_sends")
      .select("user_id, campaign_id")
      .eq("id", sendId)
      .single();

    if (send) {
      await logEvent(sendId, send.user_id, "opened");

      // Increment opened_count on campaign
      if (send.campaign_id) {
        const { data: camp } = await supabase
          .from("email_campaigns")
          .select("opened_count")
          .eq("id", send.campaign_id)
          .single();
        if (camp) {
          await supabase
            .from("email_campaigns")
            .update({ opened_count: (camp.opened_count || 0) + 1 })
            .eq("id", send.campaign_id);
        }
      }
    }
  } catch (e) {
    console.error("[email/track]", e);
  }

  // Return 1x1 transparent GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
  res.end(pixel);
});

// ─── GET /api/email/stats — aggregated metrics ──────────────────────────────

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId obrigatório" });

    const { data: sends } = await supabase
      .from("email_sends")
      .select("status, opened_at")
      .eq("user_id", userId);

    const total = sends?.length || 0;
    const sent = sends?.filter((s: any) => s.status === "sent").length || 0;
    const failed = sends?.filter((s: any) => s.status === "failed").length || 0;
    const opened = sends?.filter((s: any) => s.opened_at).length || 0;
    const pending = sends?.filter((s: any) => s.status === "pending").length || 0;

    res.json({ total, sent, failed, opened, pending, openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0" });
  } catch (err: any) {
    console.error("[email/stats]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/email/webhook/inbound — external webhook ────────────────────

router.post("/webhook/inbound", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;
    if (!apiKey) return res.status(401).json({ error: "X-API-Key obrigatório" });

    // Find user by API key in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("openai_api_key", apiKey)
      .maybeSingle();

    // Also check platform_connections for the api key
    let userId: string | null = profile?.user_id || null;

    if (!userId) {
      const { data: pc } = await supabase
        .from("platform_connections")
        .select("user_id")
        .eq("platform", "custom_api")
        .eq("credentials->>api_key", apiKey)
        .maybeSingle();
      if (pc) userId = pc.user_id;
    }

    if (!userId) return res.status(401).json({ error: "API Key inválida" });

    const { event, data } = req.body;

    // Log the request
    await supabase.from("api_request_logs").insert({
      user_id: userId,
      method: "POST",
      path: "/api/email/webhook/inbound",
      status_code: 200,
      request_body: req.body,
      response_summary: `Event: ${event}`,
      ip_address: req.ip,
    });

    switch (event) {
      case "send_email": {
        const { to, subject, html, templateId, recipientName } = data;
        if (!to || !subject || !html) {
          return res.status(400).json({ error: "send_email requer: to, subject, html" });
        }
        const smtpConfig = await getSmtpConfig(userId);
        const transporter = createTransporter(smtpConfig);

        const { data: sendLog } = await supabase
          .from("email_sends")
          .insert({
            user_id: userId,
            template_id: templateId || null,
            recipient_email: to,
            recipient_name: recipientName || null,
            status: "pending",
          })
          .select()
          .single();

        await transporter.sendMail({
          from: smtpConfig.from_name
            ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
            : smtpConfig.from_email,
          to,
          subject,
          html,
        });

        if (sendLog) {
          await supabase.from("email_sends").update({ status: "sent" }).eq("id", sendLog.id);
          await logEvent(sendLog.id, userId, "sent");
        }
        return res.json({ ok: true, sendId: sendLog?.id });
      }

      case "trigger_campaign": {
        const { campaignId } = data;
        if (!campaignId) return res.status(400).json({ error: "trigger_campaign requer: campaignId" });
        // Trigger campaign in background (reuse internal logic)
        // We call the same endpoint internally
        const smtpConfig = await getSmtpConfig(userId);
        await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);
        return res.json({ ok: true, message: "Campanha iniciada" });
      }

      case "add_to_campaign": {
        const { campaignId: cId, email, name } = data;
        if (!cId || !email) return res.status(400).json({ error: "add_to_campaign requer: campaignId, email" });

        // Check if campaign has follow-ups
        const { data: followUps } = await supabase
          .from("email_follow_ups")
          .select("*")
          .eq("campaign_id", cId)
          .order("step_order");

        if (followUps && followUps.length > 0) {
          for (const fu of followUps) {
            const scheduledAt = new Date();
            scheduledAt.setDate(scheduledAt.getDate() + fu.delay_days);
            await supabase.from("email_follow_up_sends").insert({
              follow_up_id: fu.id,
              user_id: userId,
              recipient_email: email,
              status: "pending",
              scheduled_at: scheduledAt.toISOString(),
            });
          }
        }
        return res.json({ ok: true, message: "Contato adicionado à campanha" });
      }

      case "register_email": {
        const { email: regEmail, name: regName, tags: regTags } = data || {};
        if (!regEmail) return res.status(400).json({ error: "register_email requer: email" });

        const { data: contact, error: upsertErr } = await supabase
          .from("email_contacts")
          .upsert(
            {
              user_id: userId,
              email: regEmail.toLowerCase().trim(),
              name: regName || null,
              tags: regTags || [],
              source: "webhook",
              status: "active",
            },
            { onConflict: "user_id,email" }
          )
          .select("id")
          .single();

        if (upsertErr) return res.status(500).json({ error: upsertErr.message });
        return res.json({ ok: true, contactId: contact?.id });
      }

      default:
        return res.status(400).json({ error: `Evento desconhecido: ${event}` });
    }
  } catch (err: any) {
    console.error("[email/webhook/inbound]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/email/webhook/events — bounce/delivery events ───────────────

router.post("/webhook/events", async (req: Request, res: Response) => {
  try {
    const { event, email, sendId, userId: uid, reason } = req.body;

    if (event === "bounce" || event === "complaint") {
      if (email && uid) {
        await supabase.from("email_suppressions").upsert(
          { user_id: uid, email: email.toLowerCase(), reason: event },
          { onConflict: "user_id,email" }
        );
      }
      if (sendId && uid) {
        await logEvent(sendId, uid, event, { reason });
      }
    }

    if (event === "delivered" && sendId && uid) {
      await logEvent(sendId, uid, "delivered");
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[email/webhook/events]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/email/check-follow-ups — process pending follow-ups (cron) ──

router.post("/check-follow-ups", async (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();

    const { data: pendingSends } = await supabase
      .from("email_follow_up_sends")
      .select("*, email_follow_ups(*, email_templates(*))")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .limit(50);

    if (!pendingSends || pendingSends.length === 0) {
      return res.json({ ok: true, processed: 0 });
    }

    let processed = 0;

    for (const send of pendingSends) {
      const fu = send.email_follow_ups as any;
      if (!fu || !fu.email_templates) {
        await supabase
          .from("email_follow_up_sends")
          .update({ status: "failed", error_message: "Template não encontrado" })
          .eq("id", send.id);
        continue;
      }

      const template = fu.email_templates as any;
      const userId = send.user_id;

      if (await isSuppressed(userId, send.recipient_email)) {
        await supabase
          .from("email_follow_up_sends")
          .update({ status: "failed", error_message: "E-mail suprimido" })
          .eq("id", send.id);
        continue;
      }

      try {
        const smtpConfig = await getSmtpConfig(userId);
        const transporter = createTransporter(smtpConfig);

        const personalizedHtml = replaceVariables(template.html_body, {
          nome: null,
          email: send.recipient_email,
          telefone: null,
        });

        await transporter.sendMail({
          from: smtpConfig.from_name
            ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
            : smtpConfig.from_email,
          to: send.recipient_email,
          subject: template.subject,
          html: personalizedHtml,
        });

        await supabase
          .from("email_follow_up_sends")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", send.id);

        processed++;
        await sleep(3000);
      } catch (sendErr: any) {
        await supabase
          .from("email_follow_up_sends")
          .update({ status: "failed", error_message: sendErr.message })
          .eq("id", send.id);
        console.error(`[email/follow-up] Falha para ${send.recipient_email}:`, sendErr.message);
      }
    }

    res.json({ ok: true, processed });
  } catch (err: any) {
    console.error("[email/check-follow-ups]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
