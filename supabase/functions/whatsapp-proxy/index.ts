const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Stub. Na VPS, o Nginx intercepta esta rota e encaminha para o backend Express,
  // que se comunica com o Baileys gateway (deploy/baileys-gateway).
  return new Response(
    JSON.stringify({
      error: "Este recurso requer o backend self-hosted (Baileys gateway). Configure o deploy na VPS.",
      info: "Na VPS, esta rota é interceptada pelo Nginx e encaminhada para o backend Express, que conversa com o Baileys gateway próprio.",
    }),
    {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
