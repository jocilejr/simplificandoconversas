import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

router.post("/", async (req, res) => {
  const { workspace_id, start_date, end_date } = req.body || {};
  if (!workspace_id || !start_date || !end_date) {
    return res.status(400).json({ error: "Missing params" });
  }

  const sb = getServiceClient();

  const { data: accounts, error: accErr } = await sb
    .from("meta_ad_accounts")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("enabled", true);

  if (accErr) return res.status(500).json({ error: accErr.message });
  if (!accounts || accounts.length === 0) {
    return res.status(400).json({ error: "No Meta Ads accounts connected" });
  }

  let totalSynced = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    const { access_token, ad_account_id, id: account_id, label } = account;
    if (!access_token || !ad_account_id) continue;

    try {
      const accountId = ad_account_id.startsWith("act_") ? ad_account_id : `act_${ad_account_id}`;
      const url =
        `https://graph.facebook.com/v21.0/${encodeURIComponent(accountId)}/insights?` +
        `time_range=${encodeURIComponent(JSON.stringify({ since: start_date, until: end_date }))}&` +
        `fields=spend,campaign_name,date_start&level=campaign&time_increment=1&limit=500&` +
        `access_token=${encodeURIComponent(access_token)}`;

      const metaRes = await fetch(url);
      const metaData: any = await metaRes.json();

      if (metaData.error) {
        errors.push(`${label}: ${metaData.error.message}`);
        continue;
      }

      const rows = ((metaData.data as any[]) || []).map((row: any) => ({
        workspace_id,
        date: row.date_start,
        spend: parseFloat(row.spend || "0"),
        campaign_name: row.campaign_name || "Sem nome",
        account_id,
      }));

      if (rows.length > 0) {
        const { error } = await sb.from("meta_ad_spend").upsert(rows, {
          onConflict: "workspace_id,date,campaign_name",
        });
        if (error) {
          errors.push(`${label}: ${error.message}`);
        } else {
          totalSynced += rows.length;
        }
      }
    } catch (e: any) {
      errors.push(`${label}: ${e.message}`);
    }
  }

  return res.json({ synced: totalSynced, accounts: accounts.length, errors });
});

export default router;
