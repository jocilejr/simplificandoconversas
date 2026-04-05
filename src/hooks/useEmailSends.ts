import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEmailSends(filters?: { status?: string; campaignId?: string }) {
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
        .limit(100);

      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.campaignId) q = q.eq("campaign_id", filters.campaignId);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  return { sends, isLoading, refetch };
}
