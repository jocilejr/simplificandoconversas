const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // This edge function is a stub. On the VPS, Nginx intercepts this route
  // and forwards it to the Express backend before it reaches here.
  // If this code runs, it means the app is not on the self-hosted environment.
  return new Response(
    JSON.stringify({
      error: "This feature requires the self-hosted backend (Evolution API). Configure your VPS deployment.",
      info: "Na VPS, esta rota é interceptada pelo Nginx e encaminhada para o backend Express que se comunica com a Evolution API.",
    }),
    {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
