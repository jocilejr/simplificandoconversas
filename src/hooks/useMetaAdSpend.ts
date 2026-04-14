import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useMetaAdSpend(startDate?: Date, endDate?: Date) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ["meta-ad-spend", workspaceId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!workspaceId,
    queryFn: async () => {
      let query = supabase
        .from("meta_ad_spend")
        .select("*")
        .eq("workspace_id", workspaceId!);

      if (startDate) {
        query = query.gte("date", startDate.toISOString().split("T")[0]);
      }
      if (endDate) {
        query = query.lte("date", endDate.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalSpend = (data || []).reduce((sum, row) => sum + Number(row.spend), 0);
      return { rows: data || [], totalSpend };
    },
  });
}
