import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pixels, event_id, value, phone, email, first_name, last_name, source_url } = await req.json();

    if (!pixels || !Array.isArray(pixels) || pixels.length === 0) {
      return new Response(JSON.stringify({ error: "pixels array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    const timestamp = Math.floor(Date.now() / 1000);

    const userData: Record<string, any> = {};
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      const formatted = digits.length >= 10 && digits.length <= 11 ? "55" + digits : digits;
      if (formatted.length >= 12) {
        userData.ph = [await sha256(formatted)];
        userData.external_id = [await sha256(formatted)];
      }
    }
    if (email) userData.em = [await sha256(email.toLowerCase().trim())];
    if (first_name) userData.fn = [await sha256(first_name.toLowerCase().trim())];
    if (last_name) userData.ln = [await sha256(last_name.toLowerCase().trim())];
    userData.country = [await sha256("br")];

    for (const pixel of pixels) {
      const { pixel_id, access_token, event_name } = pixel;
      if (!pixel_id || !access_token) continue;

      const eventData: Record<string, any> = {
        event_name: event_name || "Purchase",
        event_time: timestamp,
        action_source: "website",
        user_data: userData,
        custom_data: { value: value || 0, currency: "BRL", content_type: "product" },
      };
      if (event_id) eventData.event_id = event_id;
      if (source_url) eventData.event_source_url = source_url;

      try {
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${pixel_id}/events?access_token=${access_token}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [eventData] }) }
        );
        const result = await response.json();
        results.push({ pixel_id, status: response.ok ? "success" : "error", result });
      } catch (err) {
        results.push({ pixel_id, status: "error", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[CAPI] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
