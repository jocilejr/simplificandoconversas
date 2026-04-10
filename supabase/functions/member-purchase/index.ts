import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, offer_name, payment_method, amount } = await req.json();

    if (!phone || !offer_name || !payment_method) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const normalizedPhone = phone.replace(/\D/g, "");

    const typeMap: Record<string, string> = { pix: "pix", cartao: "cartao", boleto: "boleto" };

    const { error } = await supabase.from("transactions").insert({
      type: typeMap[payment_method] || "pix",
      status: "pendente",
      amount: amount || 0,
      customer_phone: normalizedPhone,
      normalized_phone: normalizedPhone,
      description: `[Área de Membros] ${offer_name}`,
      webhook_source: "member-area",
    });

    if (error) {
      console.error("Error inserting transaction:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
