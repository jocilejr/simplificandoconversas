import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

router.get("/", async (req, res) => {
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  const botPatterns = [
    "facebookexternalhit", "facebot", "telegrambot",
    "twitterbot", "linkedinbot", "slackbot", "discordbot",
    "googlebot", "bingbot", "yandexbot", "baiduspider",
    "preview", "crawler", "spider", "bot", "curl", "wget",
    "python-requests", "go-http-client", "java/", "apache-httpclient",
    "headless", "phantom", "selenium", "puppeteer", "applebot",
    "pinterestbot", "redditbot", "embedly", "quora", "outbrain",
    "vkshare", "w3c_validator", "skypeuripreview", "nuzzel",
    "flipboard", "tumblr", "bitlybot", "mediapartners-google",
  ];
  const isBotPattern = botPatterns.some((p) => userAgent.includes(p));
  // WhatsApp crawler UA: "WhatsApp/2.x.x" (no Mozilla). In-app browser: "Mozilla/... WhatsApp/..."
  const isWhatsAppCrawler = userAgent.includes("whatsapp") && !userAgent.includes("mozilla");
  const isBotUA = isBotPattern || isWhatsAppCrawler;

  const code = req.query.code as string;
  if (!code) return res.status(400).send("Missing code");

  const serviceClient = getServiceClient();

  const { data: link, error } = await serviceClient
    .from("tracked_links")
    .select("*")
    .eq("short_code", code)
    .single();

  if (error || !link) return res.status(404).send("Link not found");

  const createdAt = new Date(link.created_at).getTime();
  const now = Date.now();
  const tooFast = (now - createdAt) < 15000;
  const isBot = isBotUA || tooFast;

  if (isBot) {
    console.log(`[link-redirect] Bot detected (UA-pattern: ${isBotPattern}, WA-crawler: ${isWhatsAppCrawler}, tooFast: ${tooFast}) code=${code} UA: ${userAgent}`);

    const title = link.preview_title || link.original_url;
    const description = link.preview_description || "";
    const image = link.preview_image || "";
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
  ${image ? `<meta property="og:image" content="${image.replace(/"/g, '&quot;')}">` : ""}
  <meta property="og:url" content="${link.original_url}">
  <meta property="og:type" content="website">
  <meta http-equiv="refresh" content="2;url=${link.original_url}">
  <title>${title.replace(/</g, '&lt;')}</title>
</head>
<body></body>
</html>`;
    return res.status(200).type("text/html").send(html);
  }

  // Real human click
  console.log(`[link-redirect] Human click detected! code=${code} clicked=${link.clicked} execution_id=${link.execution_id} UA: ${userAgent}`);
  if (!link.clicked) {
    const processClick = async () => {
      try {
        await serviceClient.from("tracked_links").update({ clicked: true, clicked_at: new Date().toISOString() }).eq("id", link.id);

        if (link.execution_id) {
          await serviceClient.from("flow_timeouts").update({ processed: true }).eq("execution_id", link.execution_id).eq("processed", false);
        }

        let executionActive = false;
        if (link.execution_id) {
          const { data: execution } = await serviceClient.from("flow_executions").select("status").eq("id", link.execution_id).single();
          if (execution?.status === "waiting_click") {
            executionActive = true;
            await serviceClient.from("flow_executions").update({ status: "completed" }).eq("id", link.execution_id);
          }
        }

        if (executionActive && link.next_node_id && link.flow_id && link.execution_id) {
          const backendUrl = `http://localhost:${process.env.PORT || 3001}`;
          fetch(`${backendUrl}/api/execute-flow`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              flowId: link.flow_id, remoteJid: link.remote_jid, conversationId: link.conversation_id,
              userId: link.user_id, resumeFromNodeId: link.next_node_id, instanceName: link.instance_name || undefined,
            }),
          }).then(() => console.log(`[link-redirect] Resumed flow`)).catch((err) => console.error("[link-redirect] Failed:", err));
        }
      } catch (err) {
        console.error("[link-redirect] Error processing click:", err);
      }
    };
    processClick();
  }

  return res.redirect(302, link.original_url);
});

export default router;
