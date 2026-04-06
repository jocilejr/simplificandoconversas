import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiUrl, safeJsonResponse } from "@/lib/api";

interface Filters {
  status?: string;
  campaignId?: string;
  page?: number;
  pageSize?: number;
}

export function useEmailSends(filters?: Filters) {
  const page = filters?.page || 0;
  const pageSize = filters?.pageSize || 50;

  const { data: sends = [], isLoading, refetch } = useQuery({
    queryKey: ["email-sends", filters],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let q = supabase
        .from("email_sends")
        .select("*, email_templates(name), email_campaigns(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.campaignId) q = q.eq("campaign_id", filters.campaignId);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Stats query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["email-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      try {
        const resp = await fetch(apiUrl(`email/stats?userId=${user.id}`));
        const json = await safeJsonResponse(resp);
        if (!resp.ok) return { total: 0, sent: 0, failed: 0, opened: 0, pending: 0, openRate: "0" };
        return json;
      } catch {
        return { total: 0, sent: 0, failed: 0, opened: 0, pending: 0, openRate: "0" };
      }
    },
    refetchInterval: 30000,
  });

  return { sends, isLoading, refetch, stats, statsLoading };
}
