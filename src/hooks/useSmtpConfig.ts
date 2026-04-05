import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useSmtpConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["smtp-config"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("smtp_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (c: { host: string; port: number; username: string; password: string; from_email: string; from_name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("smtp_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("smtp_config").update(c).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("smtp_config").insert({ ...c, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["smtp-config"] }); toast({ title: "Configuração SMTP salva!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const testSmtp = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const resp = await fetch(`${baseUrl}/functions/v1/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Erro no teste SMTP");
      return json;
    },
    onSuccess: () => toast({ title: "E-mail de teste enviado com sucesso!" }),
    onError: (e: Error) => toast({ title: "Erro no teste", description: e.message, variant: "destructive" }),
  });

  return { config, isLoading, saveConfig, testSmtp };
}
