import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { resolveWorkspaceId } from "../lib/workspace";

const router = Router();

// ─── Email normalizer (similarity-based engine) ────────────────────────────

const CANONICAL_DOMAINS = [
  "gmail.com","hotmail.com","hotmail.com.br","outlook.com","outlook.com.br",
  "yahoo.com","yahoo.com.br","icloud.com","live.com","uol.com.br","bol.com.br",
  "terra.com.br","ig.com.br","globo.com","globomail.com","protonmail.com",
  "msn.com","aol.com","zoho.com","r7.com",
];
const CANONICAL_SET = new Set(CANONICAL_DOMAINS);
const KNOWN_ALIASES: Record<string,string> = {
  "gmail.com.br":"gmail.com","uol.com":"uol.com.br","bol.com":"bol.com.br",
  "terra.com":"terra.com.br","ig.com":"ig.com.br",
};

function damerauLevenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  const d: number[][] = [];
  for (let i = 0; i <= la; i++) { d[i] = new Array(lb + 1).fill(0); }
  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost);
      if (i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1])
        d[i][j] = Math.min(d[i][j], d[i-2][j-2]+cost);
    }
  }
  return d[la][lb];
}

function cleanDomain(raw: string): string {
  let c = raw.replace(/^[^a-z]+/, "");
  c = c.replace(/[^a-z.]+$/, "");
  c = c.replace(/\.+$/, "");
  return c;
}

function hasValidStructure(domain: string): boolean {
  if (!domain.includes(".")) return false;
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  if (!/^[a-z]{2,6}$/.test(tld)) return false;
  if (tld === "br" && parts.length >= 3) {
    const sld = parts[parts.length - 2];
    if (!/^[a-z]{2,4}$/.test(sld)) return false;
  }
  const provider = parts[0];
  if (provider.length === 0 || !/^[a-z]/.test(provider)) return false;
  return true;
}

function normalizeEmail(input: string): { email: string; corrected: boolean; original: string; status: string } {
  const original = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!original) return { email: original, corrected: false, original, status: "invalid" };

  let localPart: string, domain: string;
  if (original.includes("@")) {
    const i = original.indexOf("@");
    localPart = original.substring(0, i);
    domain = original.substring(i + 1);
  } else {
    // Try to infer missing @
    let found: { local: string; domain: string } | null = null;
    for (const cd of CANONICAL_DOMAINS) {
      if (original.endsWith(cd) && original.length > cd.length) {
        found = { local: original.substring(0, original.length - cd.length), domain: cd };
        break;
      }
    }
    if (!found) return { email: original, corrected: false, original, status: "invalid" };
    localPart = found.local;
    domain = found.domain;
  }
  if (!localPart || !domain) return { email: original, corrected: false, original, status: "invalid" };

  domain = domain.replace(/\.+$/, "");
  const cleaned = cleanDomain(domain);

  // Known aliases
  const aliasKey = KNOWN_ALIASES[domain] ? domain : KNOWN_ALIASES[cleaned] ? cleaned : null;
  if (aliasKey) {
    const target = KNOWN_ALIASES[aliasKey];
    return { email: `${localPart}@${target}`, corrected: true, original, status: "corrected" };
  }

  // Already canonical
  if (CANONICAL_SET.has(domain)) {
    const e = `${localPart}@${domain}`;
    return { email: e, corrected: e !== original, original, status: e !== original ? "corrected" : "exact" };
  }

  // Similarity match
  const candidates = CANONICAL_DOMAINS.map(cd => ({
    domain: cd,
    dist: Math.min(damerauLevenshtein(domain, cd), damerauLevenshtein(cleaned, cd)),
  })).sort((a, b) => a.dist - b.dist);

  const best = candidates[0];
  const gap = candidates.length > 1 ? candidates[1].dist - best.dist : best.dist + 2;
  const maxLen = Math.max(domain.length, best.domain.length);
  const similarity = 1 - best.dist / maxLen;

  // Exact after cleaning
  if (best.dist === 0 && domain !== best.domain) {
    return { email: `${localPart}@${best.domain}`, corrected: true, original, status: "corrected" };
  }
  if (best.dist === 0) {
    return { email: `${localPart}@${best.domain}`, corrected: false, original, status: "exact" };
  }

  // Confidence calc
  let conf = 0;
  if (best.dist === 1 && gap >= 1) conf = 0.95;
  else if (best.dist <= 2 && gap >= 2) conf = 0.9;
  else if (best.dist <= 2 && gap >= 1) conf = 0.85;
  else if (best.dist <= 3 && gap >= 2 && similarity >= 0.65) conf = 0.8;
  else if (best.dist <= 3 && gap >= 1 && similarity >= 0.6) conf = 0.75;
  else if (best.dist <= 4 && gap >= 2 && similarity >= 0.6) conf = 0.65;
  else if (best.dist <= 4 && gap >= 1 && similarity >= 0.55) conf = 0.55;
  else if (similarity >= 0.5) conf = 0.4;
  else conf = 0.2;

  if (conf >= 0.7) {
    return { email: `${localPart}@${best.domain}`, corrected: true, original, status: "corrected" };
  }

  // Valid custom domain?
  if (hasValidStructure(domain) && best.dist > 4) {
    return { email: `${localPart}@${domain}`, corrected: false, original, status: "exact" };
  }
  if (hasValidStructure(domain) && conf < 0.4) {
    return { email: `${localPart}@${domain}`, corrected: false, original, status: "exact" };
  }

  return { email: `${localPart}@${domain}`, corrected: false, original, status: "ambiguous" };
}

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
  metadata?: Record<string, any>,
  workspaceId?: string | null
) {
  const wsId = workspaceId || (await resolveWorkspaceId(userId));
  await supabase.from("email_events").insert({
    send_id: sendId,
    user_id: userId,
    workspace_id: wsId,
    event_type: eventType,
    metadata: metadata || {},
  });
}

/** Inject tracking pixel into HTML */
function injectTrackingPixel(html: string, sendId: string, baseUrl: string): string {
  const pixel = `<img src="${baseUrl}/api/email/track/${sendId}" width="1" height="1" style="display:none" alt="" />`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}

/** Rewrite all <a href="..."> links in HTML to tracking URLs, creating email_link_clicks records */
async function rewriteLinks(html: string, sendId: string, userId: string, baseUrl: string, workspaceId?: string | null): Promise<string> {
  const linkRegex = /<a\s([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>/gi;
  const matches: { full: string; pre: string; url: string; post: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const url = m[2];
    // Skip anchors, mailto, tel, and tracking pixels
    if (url.startsWith("#") || url.startsWith("mailto:") || url.startsWith("tel:") || url.includes("/email/track/")) continue;
    matches.push({ full: m[0], pre: m[1], url: m[2], post: m[3] });
  }
  if (matches.length === 0) return html;

  // Deduplicate URLs — one click record per unique URL per send
  const urlToId = new Map<string, string>();
  for (const match of matches) {
    if (urlToId.has(match.url)) continue;
    const wsId = workspaceId || (await resolveWorkspaceId(userId));
    const { data } = await supabase
      .from("email_link_clicks")
      .insert({ send_id: sendId, user_id: userId, workspace_id: wsId, original_url: match.url })
      .select("id")
      .single();
    if (data) urlToId.set(match.url, data.id);
  }

  let result = html;
  for (const match of matches) {
    const clickId = urlToId.get(match.url);
    if (!clickId) continue;
    const trackingUrl = `${baseUrl}/api/email/click/${clickId}`;
    const replacement = `<a ${match.pre}href="${trackingUrl}"${match.post}>`;
    result = result.replace(match.full, replacement);
  }
  return result;
}


// ─── POST /api/email/send — single email ────────────────────────────────────

router.post("/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, html, userId, templateId, recipientName, smtpConfigId } = req.body;
    if (!to || !subject || !html || !userId) {
      return res.status(400).json({ error: "Campos obrigatórios: to, subject, html, userId" });
    }

    const workspaceId = await resolveWorkspaceId(userId);
    if (!workspaceId) return res.status(400).json({ error: "Workspace não encontrado" });

    if (await isSuppressed(userId, to)) {
      return res.status(400).json({ error: "E-mail suprimido (bounce/unsubscribe)" });
    }

    const smtpConfig = await getSmtpConfig(userId, smtpConfigId);
    const transporter = createTransporter(smtpConfig);

    const { data: sendLog } = await supabase
      .from("email_sends")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        template_id: templateId || null,
        recipient_email: to,
        recipient_name: recipientName || null,
        status: "pending",
      })
      .select()
      .single();

    const appUrl = process.env.APP_PUBLIC_URL || supabaseUrl;
    let finalHtml = sendLog ? injectTrackingPixel(html, sendLog.id, appUrl) : html;
    if (sendLog) finalHtml = await rewriteLinks(finalHtml, sendLog.id, userId, appUrl, workspaceId);

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
        await logEvent(sendLog.id, userId, "sent", undefined, workspaceId);
      }
      res.json({ ok: true, sendId: sendLog?.id });
    } catch (sendErr: any) {
      if (sendLog) {
        await supabase
          .from("email_sends")
          .update({ status: "failed", error_message: sendErr.message })
          .eq("id", sendLog.id);
        await logEvent(sendLog.id, userId, "failed", { error: sendErr.message }, workspaceId);
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

    const workspaceId = await resolveWorkspaceId(userId);
    if (!workspaceId) return res.status(400).json({ error: "Workspace não encontrado" });

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

    // Get recipients from email_contacts (primary source) + conversations
    let recipients: { email: string; name: string | null; phone: string | null }[] = [];
    const existingEmails = new Set<string>();

    // 1. Email contacts (with tag filter support)
    let ecQuery = supabase
      .from("email_contacts")
      .select("email, name")
      .eq("user_id", userId)
      .eq("status", "active");

    if (campaign.tag_filter) {
      ecQuery = ecQuery.contains("tags", [campaign.tag_filter]);
    }

    const { data: emailContacts } = await ecQuery;
    if (emailContacts) {
      for (const ec of emailContacts) {
        const lower = ec.email.toLowerCase();
        if (!existingEmails.has(lower)) {
          recipients.push({ email: ec.email, name: ec.name, phone: null });
          existingEmails.add(lower);
        }
      }
    }

    // 2. Conversations (with tag filter via contact_tags)
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

    let convRecipients: typeof recipients = [];
    if (campaign.tag_filter) {
      const { data: tagged } = await supabase
        .from("contact_tags")
        .select("remote_jid")
        .eq("user_id", userId)
        .eq("tag_name", campaign.tag_filter);
      if (tagged && tagged.length > 0) {
        convRecipients = await getConversations(tagged.map((t: any) => t.remote_jid));
      }
    } else {
      convRecipients = await getConversations();
    }

    for (const cr of convRecipients) {
      const lower = cr.email.toLowerCase();
      if (!existingEmails.has(lower)) {
        recipients.push(cr);
        existingEmails.add(lower);
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
          workspace_id: workspaceId,
          campaign_id: campaignId,
          template_id: template.id,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          status: "pending",
        })
        .select()
        .single();

      let finalHtml = sendLog
        ? injectTrackingPixel(personalizedHtml, sendLog.id, appUrl)
        : personalizedHtml;
      if (sendLog) finalHtml = await rewriteLinks(finalHtml, sendLog.id, userId, appUrl, workspaceId);

      try {
        await transporter.sendMail({ from: fromAddress, to: recipient.email, subject: personalizedSubject, html: finalHtml });
        sentCount++;
        if (sendLog) {
          await supabase.from("email_sends").update({ status: "sent" }).eq("id", sendLog.id);
          await logEvent(sendLog.id, userId, "sent", undefined, workspaceId);
        }
      } catch (sendErr: any) {
        failedCount++;
        if (sendLog) {
          await supabase
            .from("email_sends")
            .update({ status: "failed", error_message: sendErr.message })
            .eq("id", sendLog.id);
          await logEvent(sendLog.id, userId, "failed", { error: sendErr.message }, workspaceId);
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
          workspace_id: workspaceId,
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

// ─── GET /api/email/click/:clickId — link click tracking ────────────────────

router.get("/click/:clickId", async (req: Request, res: Response) => {
  try {
    const { clickId } = req.params;

    const { data: click, error } = await supabase
      .from("email_link_clicks")
      .select("*, email_sends(user_id, campaign_id)")
      .eq("id", clickId)
      .single();

    if (error || !click) return res.status(404).send("Link not found");

    // Mark as clicked (only first time)
    if (!click.clicked) {
      await supabase
        .from("email_link_clicks")
        .update({ clicked: true, clicked_at: new Date().toISOString() })
        .eq("id", clickId);

      const send = click.email_sends as any;
      if (send) {
        await logEvent(click.send_id, send.user_id, "link_clicked", {
          url: click.original_url,
          click_id: clickId,
        });
      }
    }

    return res.redirect(302, click.original_url);
  } catch (err: any) {
    console.error("[email/click]", err);
    return res.status(500).send("Error");
  }
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

    // Click stats
    const { data: clicks } = await supabase
      .from("email_link_clicks")
      .select("send_id, clicked")
      .eq("user_id", userId)
      .eq("clicked", true);

    const clickedSendIds = new Set((clicks || []).map((c: any) => c.send_id));
    const clicked = clickedSendIds.size;

    res.json({
      total, sent, failed, opened, pending, clicked,
      openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0",
      clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0",
    });
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

    const workspaceId = await resolveWorkspaceId(userId);
    if (!workspaceId) return res.status(400).json({ error: "Workspace não encontrado para este usuário" });

    const { event, data } = req.body;

    // Log the request
    await supabase.from("api_request_logs").insert({
      user_id: userId,
      workspace_id: workspaceId,
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
            workspace_id: workspaceId,
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
          await logEvent(sendLog.id, userId, "sent", undefined, workspaceId);
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
              workspace_id: workspaceId,
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

        const normalized = normalizeEmail(regEmail);

        if (normalized.status === "invalid") {
          return res.status(400).json({ error: "E-mail inválido", original: normalized.original });
        }
        if (normalized.status === "ambiguous") {
          return res.status(400).json({ error: "E-mail suspeito — domínio não reconhecido", original: normalized.original });
        }

        if (normalized.corrected) {
          console.log(`[email/webhook] E-mail corrigido: ${normalized.original} → ${normalized.email}`);
        }

        // Normalize tags: trim, lowercase, deduplicate
        const rawTags: string[] = Array.isArray(regTags) ? regTags : [];
        const contactTags: string[] = [...new Set(rawTags.map((t: string) => String(t).trim().toLowerCase()).filter(Boolean))];

        console.log(`[email/register] Email: ${normalized.email} | Tags recebidas: [${contactTags.join(", ")}]`);

        const { data: contact, error: upsertErr } = await supabase
          .from("email_contacts")
          .upsert(
            {
              user_id: userId,
              workspace_id: workspaceId,
              email: normalized.email,
              name: regName || null,
              tags: contactTags,
              source: "webhook",
              status: "active",
            },
            { onConflict: "user_id,email" }
          )
          .select("id")
          .single();

        if (upsertErr) return res.status(500).json({ error: upsertErr.message });

        // Auto-send: check for campaigns with auto_send=true matching contact tags
        const matchedCampaigns: { name: string; id: string; queued: boolean; error?: string }[] = [];

        if (contactTags.length > 0) {
          try {
            const { data: autoCampaigns } = await supabase
              .from("email_campaigns")
              .select("*, email_templates(*)")
              .eq("user_id", userId)
              .eq("workspace_id", workspaceId)
              .eq("auto_send", true)
              .eq("status", "draft")
              .not("tag_filter", "is", null);

            console.log(`[email/register] Campanhas auto_send encontradas: ${autoCampaigns?.length || 0}`);

            if (autoCampaigns && autoCampaigns.length > 0) {
              for (const camp of autoCampaigns) {
                const campTag = (camp.tag_filter || "").trim().toLowerCase();
                console.log(`[email/register] Avaliando campanha "${camp.name}" (tag_filter: "${campTag}") vs tags do contato: [${contactTags.join(", ")}]`);

                if (!contactTags.includes(campTag)) continue;
                if (!camp.email_templates) {
                  console.warn(`[email/register] Campanha "${camp.name}" sem template — ignorando`);
                  matchedCampaigns.push({ name: camp.name, id: camp.id, queued: false, error: "template ausente" });
                  continue;
                }

                const template = camp.email_templates as any;

                // Check suppression
                if (await isSuppressed(userId, normalized.email)) {
                  console.log(`[email/register] Email ${normalized.email} suprimido — ignorando campanha "${camp.name}"`);
                  matchedCampaigns.push({ name: camp.name, id: camp.id, queued: false, error: "email suprimido" });
                  continue;
                }

                // Enqueue
                const { error: queueErr } = await supabase.from("email_queue").insert({
                  user_id: userId,
                  workspace_id: workspaceId,
                  campaign_id: camp.id,
                  template_id: template.id,
                  smtp_config_id: camp.smtp_config_id || null,
                  recipient_email: normalized.email,
                  recipient_name: regName || null,
                  personalization: { nome: regName || null, email: normalized.email, telefone: null },
                  status: "pending",
                });

                if (queueErr) {
                  console.error(`[email/register] FALHA ao enfileirar campanha "${camp.name}" para ${normalized.email}: ${queueErr.message}`);
                  matchedCampaigns.push({ name: camp.name, id: camp.id, queued: false, error: queueErr.message });
                } else {
                  console.log(`[email/register] ✅ Campanha "${camp.name}" enfileirada para ${normalized.email}`);
                  matchedCampaigns.push({ name: camp.name, id: camp.id, queued: true });
                }
              }
            }
          } catch (autoErr: any) {
            console.error("[email/register] Erro ao processar auto-send:", autoErr.message);
          }
        }

        // Check if any matched campaign failed to queue
        const queueErrors = matchedCampaigns.filter(c => !c.queued && c.error);
        const hasQueueFailure = queueErrors.length > 0 && matchedCampaigns.every(c => !c.queued);

        if (hasQueueFailure) {
          return res.status(500).json({
            ok: false,
            contactId: contact?.id,
            corrected: normalized.corrected,
            email: normalized.email,
            matchedCampaigns,
            error: "Todas as campanhas falharam ao enfileirar",
          });
        }

        return res.json({
          ok: true,
          contactId: contact?.id,
          corrected: normalized.corrected,
          email: normalized.email,
          matchedCampaigns,
          queued: matchedCampaigns.filter(c => c.queued).length,
        });
      }

      default:
        return res.status(400).json({ error: `Evento desconhecido: ${event}` });
    }
  } catch (err: any) {
    const msg = err?.message || err?.toString?.() || JSON.stringify(err) || "Erro desconhecido";
    console.error("[email/webhook/inbound] FULL ERROR:", err);
    console.error("[email/webhook/inbound] Message:", msg);
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/email/webhook/events — bounce/delivery events ───────────────

router.post("/webhook/events", async (req: Request, res: Response) => {
  try {
    const { event, email, sendId, userId: uid, reason } = req.body;

    if (event === "bounce" || event === "complaint") {
      if (email && uid) {
        const wsId = await resolveWorkspaceId(uid);
        await supabase.from("email_suppressions").upsert(
          { user_id: uid, workspace_id: wsId, email: email.toLowerCase(), reason: event },
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

// ─── POST /api/email/process-queue — process pending email queue (cron) ─────

router.post("/process-queue", async (_req: Request, res: Response) => {
  try {
    const { data: items } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (!items || items.length === 0) {
      return res.json({ ok: true, processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    // Group by smtp_config_id to reuse transporter
    const transporterCache = new Map<string, any>();
    const smtpConfigCache = new Map<string, any>();

    for (const item of items) {
      try {
        // Get SMTP config (cached)
        const configKey = item.smtp_config_id || item.user_id;
        if (!smtpConfigCache.has(configKey)) {
          const cfg = await getSmtpConfig(item.user_id, item.smtp_config_id || undefined);
          smtpConfigCache.set(configKey, cfg);
          transporterCache.set(configKey, createTransporter(cfg));
        }
        const smtpConfig = smtpConfigCache.get(configKey)!;
        const transporter = transporterCache.get(configKey)!;

        // Get template
        const { data: template } = await supabase
          .from("email_templates")
          .select("*")
          .eq("id", item.template_id)
          .single();

        if (!template) {
          console.error(`[email/queue] Template ${item.template_id} não encontrado para item ${item.id} (${item.recipient_email})`);
          await supabase.from("email_queue").update({
            status: "failed",
            error_message: "Template não encontrado",
            processed_at: new Date().toISOString(),
          }).eq("id", item.id);
          failed++;
          continue;
        }

        const vars = (item.personalization as any) || {};
        const personalizedHtml = replaceVariables(template.html_body, vars);
        const personalizedSubject = replaceVariables(template.subject, vars);

        // Create email_sends record
        const itemWorkspaceId = item.workspace_id || (await resolveWorkspaceId(item.user_id));
        const { data: sendLog } = await supabase
          .from("email_sends")
          .insert({
            user_id: item.user_id,
            workspace_id: itemWorkspaceId,
            campaign_id: item.campaign_id,
            template_id: item.template_id,
            recipient_email: item.recipient_email,
            recipient_name: item.recipient_name,
            status: "pending",
          })
          .select()
          .single();

        const appUrl = process.env.APP_PUBLIC_URL || supabaseUrl;
        let finalHtml = sendLog
          ? injectTrackingPixel(personalizedHtml, sendLog.id, appUrl)
          : personalizedHtml;
        if (sendLog) finalHtml = await rewriteLinks(finalHtml, sendLog.id, item.user_id, appUrl, itemWorkspaceId);

        const fromAddress = smtpConfig.from_name
          ? `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`
          : smtpConfig.from_email;

        await transporter.sendMail({
          from: fromAddress,
          to: item.recipient_email,
          subject: personalizedSubject,
          html: finalHtml,
        });

        // Mark queue item as sent
        await supabase.from("email_queue").update({
          status: "sent",
          processed_at: new Date().toISOString(),
        }).eq("id", item.id);

        // Update email_sends
        if (sendLog) {
          await supabase.from("email_sends").update({ status: "sent" }).eq("id", sendLog.id);
          await logEvent(sendLog.id, item.user_id, "sent", undefined, itemWorkspaceId);
        }

        // Update campaign counters
        if (item.campaign_id) {
          const { data: campData } = await supabase
            .from("email_campaigns")
            .select("sent_count, total_recipients")
            .eq("id", item.campaign_id)
            .single();
          if (campData) {
            await supabase.from("email_campaigns").update({
              sent_count: (campData.sent_count || 0) + 1,
              total_recipients: (campData.total_recipients || 0) + 1,
            }).eq("id", item.campaign_id);
          }
        }

        processed++;
        console.log(`[email/queue] ✅ Enviado para ${item.recipient_email} (campanha: ${item.campaign_id || "n/a"}) (${processed}/${items.length})`);
      } catch (sendErr: any) {
        failed++;
        const errMsg = sendErr?.message || String(sendErr);
        await supabase.from("email_queue").update({
          status: "failed",
          error_message: errMsg,
          processed_at: new Date().toISOString(),
        }).eq("id", item.id);
        console.error(`[email/queue] ❌ Falha para ${item.recipient_email} (campanha: ${item.campaign_id || "n/a"}): ${errMsg}`);
      }

      // Delay between sends to prevent SMTP blocking
      await sleep(3000);
    }

    console.log(`[email/queue] Ciclo finalizado: ${processed} enviados, ${failed} falhas`);
    res.json({ ok: true, processed, failed });
  } catch (err: any) {
    console.error("[email/process-queue]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
