import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useEmailCampaigns() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["email-campaigns"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*, email_templates(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addCampaign = useMutation({
    mutationFn: async (c: { name: string; template_id: string; tag_filter?: string; smtp_config_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("email_campaigns")
        .insert({ ...c, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-campaigns"] }); toast({ title: "Campanha criada!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const sendCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const resp = await fetch(`${baseUrl}/functions/v1/email/campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, userId: user.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Erro ao enviar campanha");
      return json;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-campaigns"] });
      toast({ title: `Campanha iniciada! ${data.totalRecipients} destinatários.` });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-campaigns"] }); toast({ title: "Campanha removida!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { campaigns, isLoading, addCampaign, sendCampaign, deleteCampaign };
}
