import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";

export function useGroupCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["group-campaigns", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const resp = await fetch(apiUrl(`groups/campaigns?workspaceId=${workspaceId}`));
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      instanceName: string;
      groupJids: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const resp = await fetch(apiUrl("groups/campaigns"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, workspaceId, userId: user.id }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-campaigns"] });
      toast({ title: "Campanha criada!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar campanha", description: err.message, variant: "destructive" });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const resp = await fetch(apiUrl(`groups/campaigns/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-campaigns"] });
      toast({ title: "Campanha atualizada!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(apiUrl(`groups/campaigns/${id}`), { method: "DELETE" });
      if (!resp.ok) throw new Error(await resp.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-campaigns"] });
      toast({ title: "Campanha removida!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const enqueueCampaign = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(apiUrl(`groups/campaigns/${id}/enqueue`), { method: "POST" });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["group-queue"] });
      toast({ title: `${data.enqueued} mensagens enfileiradas!` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enfileirar", description: err.message, variant: "destructive" });
    },
  });

  return { campaigns, isLoading, createCampaign, updateCampaign, deleteCampaign, enqueueCampaign };
}
