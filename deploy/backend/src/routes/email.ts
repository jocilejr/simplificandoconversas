import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getSmtpConfig(userId: string) {
  const { data, error } = await supabase
    .from("smtp_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Erro ao buscar config SMTP: " + error.message);
  if (!data || !data.host || !data.username) throw new Error("SMTP não configurado. Configure em Configurações > Aplicação.");
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

// POST /api/email/send — single email
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, html, userId, templateId, recipientName } = req.body;
    if (!to || !subject || !html || !userId) {
      return res.status(400).json({ error: "Campos obrigatórios: to, subject, html, userId" });
    }

    const smtpConfig = await getSmtpConfig(userId);
    const transporter = createTransporter(smtpConfig);

    // Log send as pending
    const { data: sendLog } = await supabase.from("email_sends").insert({
      user_id: userId,
      template_id: templateId || null,
      recipient_email: to,
      recipient_name: recipientName || null,
      status: "pending",
    }).select().single();

    try {
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
      }
      res.json({ ok: true, sendId: sendLog?.id });
    } catch (sendErr: any) {
      if (sendLog) {
        await supabase.from("email_sends").update({ status: "failed", error_message: sendErr.message }).eq("id", sendLog.id);
      }
      throw sendErr;
    }
  } catch (err: any) {
    console.error("[email/send]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/campaign — bulk send
router.post("/campaign", async (req: Request, res: Response) => {
  try {
    const { campaignId, userId } = req.body;
    if (!campaignId || !userId) {
      return res.status(400).json({ error: "Campos obrigatórios: campaignId, userId" });
    }

    // Get campaign
    const { data: campaign, error: campErr } = await supabase
      .from("email_campaigns")
      .select("*, email_templates(*)")
      .eq("id", campaignId)
      .eq("user_id", userId)
      .single();
    if (campErr || !campaign) return res.status(404).json({ error: "Campanha não encontrada" });
    if (!campaign.email_templates) return res.status(400).json({ error: "Template não encontrado" });

    const template = campaign.email_templates as any;
    const smtpConfig = await getSmtpConfig(userId);
    const transporter = createTransporter(smtpConfig);

    // Update status to sending
    await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);

    // Get contacts by tag
    let recipients: { email: string; name: string | null }[] = [];

    if (campaign.tag_filter) {
      // Get remote_jids with this tag
      const { data: tagged } = await supabase
        .from("contact_tags")
        .select("remote_jid")
        .eq("user_id", userId)
        .eq("tag_name", campaign.tag_filter);

      if (tagged && tagged.length > 0) {
        const jids = tagged.map((t: any) => t.remote_jid);
        const { data: convs } = await supabase
          .from("conversations")
          .select("email, contact_name")
          .eq("user_id", userId)
          .in("remote_jid", jids)
          .not("email", "is", null);

        if (convs) {
          recipients = convs
            .filter((c: any) => c.email && c.email.trim())
            .map((c: any) => ({ email: c.email, name: c.contact_name }));
        }
      }
    } else {
      // All contacts with email
      const { data: convs } = await supabase
        .from("conversations")
        .select("email, contact_name")
        .eq("user_id", userId)
        .not("email", "is", null);

      if (convs) {
        recipients = convs
          .filter((c: any) => c.email && c.email.trim())
          .map((c: any) => ({ email: c.email, name: c.contact_name }));
      }
    }

    // Update total
    await supabase.from("email_campaigns").update({ total_recipients: recipients.length }).eq("id", campaignId);

    // Respond immediately — process in background
    res.json({ ok: true, totalRecipients: recipients.length });

    // Send emails with delay
    let sentCount = 0;
    let failedCount = 0;
    const fromAddress = smtpConfig.from_name
      ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
      : smtpConfig.from_email;

    for (const recipient of recipients) {
      const { data: sendLog } = await supabase.from("email_sends").insert({
        user_id: userId,
        campaign_id: campaignId,
        template_id: template.id,
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        status: "pending",
      }).select().single();

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: recipient.email,
          subject: template.subject,
          html: template.html_body,
        });
        sentCount++;
        if (sendLog) await supabase.from("email_sends").update({ status: "sent" }).eq("id", sendLog.id);
      } catch (sendErr: any) {
        failedCount++;
        if (sendLog) await supabase.from("email_sends").update({ status: "failed", error_message: sendErr.message }).eq("id", sendLog.id);
        console.error(`[email/campaign] Falha para ${recipient.email}:`, sendErr.message);
      }

      // Update counts
      await supabase.from("email_campaigns").update({ sent_count: sentCount, failed_count: failedCount }).eq("id", campaignId);

      // Delay between sends
      await sleep(3000);
    }

    // Final status
    await supabase.from("email_campaigns").update({
      status: failedCount === recipients.length ? "failed" : "sent",
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    }).eq("id", campaignId);

    console.log(`[email/campaign] Campanha ${campaignId} finalizada: ${sentCount} enviados, ${failedCount} falhas`);
  } catch (err: any) {
    console.error("[email/campaign]", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /api/email/test — send test email
router.post("/test", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId obrigatório" });

    const smtpConfig = await getSmtpConfig(userId);
    const transporter = createTransporter(smtpConfig);

    await transporter.sendMail({
      from: smtpConfig.from_name
        ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
        : smtpConfig.from_email,
      to: smtpConfig.from_email,
      subject: "Teste SMTP - Origem Viva",
      html: "<h2>Teste de configuração SMTP</h2><p>Se você recebeu este e-mail, a configuração está correta!</p>",
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[email/test]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
