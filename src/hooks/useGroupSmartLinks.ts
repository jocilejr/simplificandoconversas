import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";

export interface SmartLink {
  id: string;
  workspace_id: string;
  user_id: string;
  campaign_id: string | null;
  instance_name: string | null;
  slug: string;
  max_members_per_group: number;
  group_links: GroupLink[];
  current_group_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_sync_error: string | null;
  last_sync_error_at: string | null;
  last_successful_sync_at: string | null;
}

export interface GroupLink {
  group_jid: string;
  group_name: string;
  member_count: number;
  invite_url: string;
}

export function useGroupSmartLinks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: smartLinks = [], isLoading } = useQuery({
    queryKey: ["group-smart-links", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId: workspaceId! });
      const resp = await fetch(apiUrl(`groups/smart-links?${params}`));
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json() as Promise<SmartLink[]>;
    },
  });

  const createSmartLink = useMutation({
    mutationFn: async (payload: { slug: string; maxMembersPerGroup?: number; instanceName: string; groupLinks: GroupLink[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const resp = await fetch(apiUrl("groups/smart-links"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, workspaceId, userId: user.id }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-smart-links"] });
      toast({ title: "Smart Link criado!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar Smart Link", description: err.message, variant: "destructive" });
    },
  });

  const updateSmartLink = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; slug?: string; maxMembersPerGroup?: number; groupLinks?: GroupLink[]; isActive?: boolean }) => {
      const resp = await fetch(apiUrl(`groups/smart-links/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-smart-links"] });
      toast({ title: "Smart Link atualizado!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteSmartLink = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(apiUrl(`groups/smart-links/${id}`), { method: "DELETE" });
      if (!resp.ok) throw new Error(await resp.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-smart-links"] });
      toast({ title: "Smart Link removido!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const syncInviteLinks = useMutation({
    mutationFn: async (smartLinkId: string) => {
      const resp = await fetch(apiUrl("groups/smart-links/sync-invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smartLinkId, workspaceId }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["group-smart-links"] });
      toast({ title: `${data.synced} links sincronizados!` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    },
  });

  return {
    smartLinks,
    isLoading,
    createSmartLink,
    updateSmartLink,
    deleteSmartLink,
    syncInviteLinks,
  };
}

export function useSmartLinkStats(smartLinkId: string | null) {
  const { data: stats } = useQuery({
    queryKey: ["group-smart-link-stats", smartLinkId],
    enabled: !!smartLinkId,
    queryFn: async () => {
      const resp = await fetch(apiUrl(`groups/smart-link-stats?smartLinkId=${smartLinkId}`));
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
  });
  return stats;
}
