import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useMetaAdSpend(startDate?: Date, endDate?: Date) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const syncedRef = useRef<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const startStr = startDate ? toLocalDateStr(startDate) : undefined;
  const endStr = endDate ? toLocalDateStr(endDate) : undefined;
  const syncKey = `${workspaceId}-${startStr}-${endStr}`;

  // Auto-sync when dates/workspace change
  useEffect(() => {
    if (!workspaceId || !startStr || !endStr) return;
    if (syncedRef.current === syncKey) return;
    syncedRef.current = syncKey;

    const doSync = async () => {
      setIsSyncing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        await fetch(apiUrl("sync-meta-ads"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            start_date: startStr,
            end_date: endStr,
          }),
        });
        queryClient.invalidateQueries({ queryKey: ["meta-ad-spend"] });
      } catch (e) {
        console.warn("Meta Ads sync failed:", e);
        syncedRef.current = null;
      } finally {
        setIsSyncing(false);
      }
    };
    doSync();
  }, [workspaceId, startStr, endStr, syncKey, queryClient]);

  const query = useQuery({
    queryKey: ["meta-ad-spend", workspaceId, startStr, endStr],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = supabase
        .from("meta_ad_spend")
        .select("*")
        .eq("workspace_id", workspaceId!);

      if (startDate) q = q.gte("date", startStr!);
      if (endDate) q = q.lte("date", endStr!);

      const { data, error } = await q;
      if (error) throw error;

      const totalSpend = (data || []).reduce((sum, row) => sum + Number(row.spend), 0);
      return { rows: data || [], totalSpend };
    },
  });

  return { ...query, isSyncing };
}
