import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface TemplateStats {
  sent: number;
  opened: number;
  openRate: number;
}

export function useEmailTemplates() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: templateStats = {} } = useQuery<Record<string, TemplateStats>>({
    queryKey: ["email-template-stats", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sends")
        .select("template_id, opened_at")
        .eq("workspace_id", workspaceId!)
        .not("template_id", "is", null);
      if (error) throw error;

      const map: Record<string, { sent: number; opened: number }> = {};
      for (const row of data || []) {
        const tid = row.template_id as string;
        if (!map[tid]) map[tid] = { sent: 0, opened: 0 };
        map[tid].sent++;
        if (row.opened_at) map[tid].opened++;
      }

      const result: Record<string, TemplateStats> = {};
      for (const [tid, s] of Object.entries(map)) {
        result[tid] = { ...s, openRate: s.sent > 0 ? Math.round((s.opened / s.sent) * 100) : 0 };
      }
      return result;
    },
  });

  const addTemplate = useMutation({
    mutationFn: async (t: { name: string; subject: string; html_body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const { error } = await supabase.from("email_templates").insert({ ...t, user_id: user.id, workspace_id: workspaceId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-templates"] }); toast({ title: "Template salvo!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; subject?: string; html_body?: string }) => {
      const { error } = await supabase.from("email_templates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-templates"] }); toast({ title: "Template atualizado!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-templates"] }); toast({ title: "Template removido!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { templates, isLoading, templateStats, addTemplate, updateTemplate, deleteTemplate };
}
