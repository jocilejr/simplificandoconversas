import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { workspace_id, start_date, end_date } = await req.json();
    if (!workspace_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: corsHeaders });
    }

    // Get Meta credentials
    const { data: conn } = await supabase
      .from("platform_connections")
      .select("credentials")
      .eq("workspace_id", workspace_id)
      .eq("platform", "meta_ads")
      .eq("enabled", true)
      .single();

    if (!conn?.credentials) {
      return new Response(JSON.stringify({ error: "Meta Ads not connected" }), { status: 400, headers: corsHeaders });
    }

    const { access_token, ad_account_id } = conn.credentials as { access_token: string; ad_account_id: string };
    if (!access_token || !ad_account_id) {
      return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400, headers: corsHeaders });
    }

    // Fetch from Meta API
    const url = `https://graph.facebook.com/v21.0/${ad_account_id}/insights?` +
      `time_range={"since":"${start_date}","until":"${end_date}"}&` +
      `fields=spend,campaign_name,date_start&level=campaign&time_increment=1&limit=500&` +
      `access_token=${access_token}`;

    const metaRes = await fetch(url);
    const metaData = await metaRes.json();

    if (metaData.error) {
      return new Response(JSON.stringify({ error: metaData.error.message }), { status: 400, headers: corsHeaders });
    }

    const rows = (metaData.data || []).map((row: any) => ({
      workspace_id,
      date: row.date_start,
      spend: parseFloat(row.spend || "0"),
      campaign_name: row.campaign_name || "Sem nome",
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("meta_ad_spend").upsert(rows, {
        onConflict: "workspace_id,date,campaign_name",
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ synced: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
