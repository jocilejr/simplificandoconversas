import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

export function useGroupScheduledMessages(campaignId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["group-scheduled-messages", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const resp = await fetch(apiUrl(`groups/campaigns/${campaignId}/messages`));
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
  });

  const createMessage = useMutation({
    mutationFn: async (payload: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const resp = await fetch(apiUrl(`groups/campaigns/${campaignId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, workspaceId, userId: user.id }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-scheduled-messages", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["group-campaigns"] });
      toast({ title: "Mensagem agendada!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao agendar", description: err.message, variant: "destructive" });
    },
  });

  const updateMessage = useMutation({
    mutationFn: async ({ msgId, ...payload }: { msgId: string; [key: string]: any }) => {
      const resp = await fetch(apiUrl(`groups/campaigns/${campaignId}/messages/${msgId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-scheduled-messages", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["group-campaigns"] });
      toast({ title: "Mensagem atualizada!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (msgId: string) => {
      const resp = await fetch(apiUrl(`groups/campaigns/${campaignId}/messages/${msgId}`), { method: "DELETE" });
      if (!resp.ok) throw new Error(await resp.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-scheduled-messages", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["group-campaigns"] });
      toast({ title: "Mensagem removida!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const toggleMessage = useMutation({
    mutationFn: async (msgId: string) => {
      const resp = await fetch(apiUrl(`groups/campaigns/${campaignId}/messages/${msgId}/toggle`), { method: "PATCH" });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-scheduled-messages", campaignId] });
    },
  });

  return { messages, isLoading, createMessage, updateMessage, deleteMessage, toggleMessage };
}
