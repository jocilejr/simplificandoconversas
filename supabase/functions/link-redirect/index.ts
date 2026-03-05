import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const botPatterns = [
    "whatsapp", "facebookexternalhit", "facebot", "telegrambot",
    "twitterbot", "linkedinbot", "slackbot", "discordbot",
    "googlebot", "bingbot", "yandexbot", "baiduspider",
    "preview", "crawler", "spider", "bot", "curl", "wget",
    "python-requests", "go-http-client", "java/", "apache-httpclient",
    "headless", "phantom", "selenium", "puppeteer", "applebot",
    "pinterestbot", "redditbot", "embedly", "quora", "outbrain",
    "vkshare", "w3c_validator", "skypeuripreview", "nuzzel",
    "flipboard", "tumblr", "bitlybot", "mediapartners-google",
  ];
  const isBotUA = botPatterns.some((p) => userAgent.includes(p));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: link, error } = await serviceClient
    .from("tracked_links")
    .select("*")
    .eq("short_code", code)
    .single();

  if (error || !link) {
    return new Response("Link not found", { status: 404 });
  }

  // Temporal protection: any access within 15 seconds of creation is treated as bot/preview
  const createdAt = new Date(link.created_at).getTime();
  const now = Date.now();
  const tooFast = (now - createdAt) < 15000;

  const isBot = isBotUA || tooFast;

  // Serve OG HTML for bots/previews
  if (isBot) {
    console.log(`[link-redirect] Bot detected (UA: ${isBotUA}, tooFast: ${tooFast}). UA: ${userAgent}`);

    if (link.preview_title || link.preview_description || link.preview_image) {
      const title = link.preview_title || "Link";
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
  <title>${title.replace(/</g, '&lt;')}</title>
</head>
<body></body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
      });
    }

    // If no preview data, just redirect without marking as clicked
    return new Response(null, {
      status: 302,
      headers: { Location: link.original_url, ...corsHeaders },
    });
  }

  // Real human click — redirect IMMEDIATELY, process in background
  if (!link.clicked) {
    // Fire-and-forget: mark as clicked and resume flow in background
    const processClick = async () => {
      try {
        await serviceClient
          .from("tracked_links")
          .update({ clicked: true, clicked_at: new Date().toISOString() })
          .eq("id", link.id);

        // Check if the execution is still waiting for this click
        let executionActive = false;
        if (link.execution_id) {
          const { data: execution } = await serviceClient
            .from("flow_executions")
            .select("status")
            .eq("id", link.execution_id)
            .single();

          if (execution?.status === "waiting_click") {
            executionActive = true;
            // Mark the old execution as completed since the click happened
            await serviceClient
              .from("flow_executions")
              .update({ status: "completed" })
              .eq("id", link.execution_id);
          } else {
            console.log(`[link-redirect] Execution ${link.execution_id} status is '${execution?.status}' - not resuming flow`);
          }
        }

        if (executionActive && link.next_node_id && link.flow_id && link.execution_id) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          fetch(`${supabaseUrl}/functions/v1/execute-flow`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              flowId: link.flow_id,
              remoteJid: link.remote_jid,
              conversationId: link.conversation_id,
              userId: link.user_id,
              resumeFromNodeId: link.next_node_id,
              instanceName: link.instance_name || undefined,
            }),
          }).then(() => {
            console.log(`[link-redirect] Resumed flow ${link.flow_id} from node ${link.next_node_id} via instance ${link.instance_name}`);
          }).catch((err) => {
            console.error("[link-redirect] Failed to resume flow:", err);
          });
        }
      } catch (err) {
        console.error("[link-redirect] Error processing click:", err);
      }
    };
    // Don't await — let it run in background
    processClick();
  }

  // Redirect immediately without waiting for processing
  return new Response(null, {
    status: 302,
    headers: { Location: link.original_url, ...corsHeaders },
  });
});
