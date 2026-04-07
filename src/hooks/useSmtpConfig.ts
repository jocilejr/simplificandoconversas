import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl, safeJsonResponse } from "@/lib/api";

export function useSmtpConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["smtp-configs", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smtp_config")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const config = configs.length > 0 ? configs[0] : null;

  const saveConfig = useMutation({
    mutationFn: async (c: { id?: string; host: string; port: number; username: string; password: string; from_email: string; from_name: string; label?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!workspaceId) throw new Error("Workspace não selecionado");

      if (c.id) {
        const { error } = await supabase.from("smtp_config").update({
          host: c.host, port: c.port, username: c.username, password: c.password,
          from_email: c.from_email, from_name: c.from_name, label: c.label || "Principal",
        }).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("smtp_config").insert({
          ...c, user_id: user.id, workspace_id: workspaceId, label: c.label || "Principal",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["smtp-configs"] }); toast({ title: "Configuração SMTP salva!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("smtp_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["smtp-configs"] }); toast({ title: "Configuração removida!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const testSmtp = useMutation({
    mutationFn: async (params: { smtpConfigId?: string; host?: string; port?: number; username?: string; password?: string; from_email?: string; from_name?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const resp = await fetch(apiUrl("email/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...params }),
      });
      const json = await safeJsonResponse(resp);
      if (!resp.ok) throw new Error(json.error || "Erro no teste SMTP");
      return json;
    },
    onSuccess: () => toast({ title: "E-mail de teste enviado com sucesso!" }),
    onError: (e: Error) => toast({ title: "Erro no teste", description: e.message, variant: "destructive" }),
  });

  const verifySmtp = useMutation({
    mutationFn: async (params: { smtpConfigId?: string; host?: string; port?: number; username?: string; password?: string; from_email?: string; from_name?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const resp = await fetch(apiUrl("email/verify-smtp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...params }),
      });
      const json = await safeJsonResponse(resp);
      if (!resp.ok) throw new Error(json.error || "Erro na verificação");
      return json;
    },
    onSuccess: () => toast({ title: "Conexão SMTP verificada com sucesso!" }),
    onError: (e: Error) => toast({ title: "Falha na conexão", description: e.message, variant: "destructive" }),
  });

  return { config, configs, isLoading, saveConfig, deleteConfig, testSmtp, verifySmtp };
}
