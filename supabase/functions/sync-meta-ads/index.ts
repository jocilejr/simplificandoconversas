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

    // Get all enabled Meta Ads accounts for this workspace
    const { data: accounts } = await supabase
      .from("meta_ad_accounts")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("enabled", true);

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ error: "No Meta Ads accounts connected" }), { status: 400, headers: corsHeaders });
    }

    let totalSynced = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const { access_token, ad_account_id, id: account_id } = account;
      if (!access_token || !ad_account_id) continue;

      try {
        const url = `https://graph.facebook.com/v21.0/${ad_account_id}/insights?` +
          `time_range={"since":"${start_date}","until":"${end_date}"}&` +
          `fields=spend,campaign_name,date_start&level=campaign&time_increment=1&limit=500&` +
          `access_token=${access_token}`;

        const metaRes = await fetch(url);
        const metaData = await metaRes.json();

        if (metaData.error) {
          errors.push(`${account.label}: ${metaData.error.message}`);
          continue;
        }

        const rows = (metaData.data || []).map((row: any) => ({
          workspace_id,
          date: row.date_start,
          spend: parseFloat(row.spend || "0"),
          campaign_name: row.campaign_name || "Sem nome",
          account_id,
        }));

        if (rows.length > 0) {
          const { error } = await supabase.from("meta_ad_spend").upsert(rows, {
            onConflict: "workspace_id,date,campaign_name",
          });
          if (error) {
            errors.push(`${account.label}: ${error.message}`);
          } else {
            totalSynced += rows.length;
          }
        }
      } catch (e: any) {
        errors.push(`${account.label}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ synced: totalSynced, accounts: accounts.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
