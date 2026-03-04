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

  // Detect bot/preview user agents (WhatsApp link preview, Facebook crawler, etc.)
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const botPatterns = [
    "whatsapp", "facebookexternalhit", "facebot", "telegrambot",
    "twitterbot", "linkedinbot", "slackbot", "discordbot",
    "googlebot", "bingbot", "yandexbot", "baiduspider",
    "preview", "crawler", "spider", "bot", "curl", "wget",
    "python-requests", "go-http-client", "java/", "apache-httpclient"
  ];
  const isBot = botPatterns.some((p) => userAgent.includes(p));

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

  // Only process click if NOT a bot/preview request
  if (!link.clicked && !isBot) {
    await serviceClient
      .from("tracked_links")
      .update({ clicked: true, clicked_at: new Date().toISOString() })
      .eq("id", link.id);

    // Resume the flow from the next node
    if (link.next_node_id && link.flow_id && link.execution_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        await fetch(`${supabaseUrl}/functions/v1/execute-flow`, {
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
          }),
        });
        console.log(`[link-redirect] Resumed flow ${link.flow_id} from node ${link.next_node_id}`);
      } catch (err) {
        console.error("[link-redirect] Failed to resume flow:", err);
      }
    }
  } else if (isBot) {
    console.log(`[link-redirect] Ignored bot/preview request. UA: ${userAgent}`);
    
    // Serve OG HTML for link preview if preview data exists
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
  }

  // Always redirect to original URL
  return new Response(null, {
    status: 302,
    headers: {
      Location: link.original_url,
      ...corsHeaders,
    },
  });
});
