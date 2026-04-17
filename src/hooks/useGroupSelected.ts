import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";

export interface SelectedGroup {
  id: string;
  workspace_id: string;
  user_id: string;
  instance_name: string;
  group_jid: string;
  group_name: string;
  member_count: number;
  created_at: string;
}

export interface RemoteGroup {
  jid: string;
  name: string;
  memberCount: number;
}

export function useGroupSelected() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const isLovablePreview = (import.meta.env.VITE_SUPABASE_URL || "").includes(".supabase.co");

  const { data: selectedGroups = [], isLoading } = useQuery({
    queryKey: ["group-selected", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60 * 60 * 1000, // 1h
    refetchInterval: 60 * 60 * 1000, // 1h
    queryFn: async () => {
      if (isLovablePreview) {
        const { data, error } = await supabase
          .from("group_selected")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return data as SelectedGroup[];
      }

      const resp = await fetch(`${apiUrl("groups/selected-groups")}?workspaceId=${encodeURIComponent(workspaceId!)}`);

      if (!resp.ok) {
        const contentType = resp.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const payload = await resp.json().catch(() => null);
          throw new Error(payload?.error || payload?.message || "Erro ao carregar grupos monitorados");
        }

        throw new Error((await resp.text()) || "Erro ao carregar grupos monitorados");
      }

      return (await resp.json()) as SelectedGroup[];
    },
  });

  const fetchGroups = useMutation({
    mutationFn: async (instanceName: string) => {
      const resp = await fetch(apiUrl("groups/fetch-groups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, workspaceId }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return (await resp.json()) as RemoteGroup[];
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao buscar grupos", description: err.message, variant: "destructive" });
    },
  });

  const addGroups = useMutation({
    mutationFn: async ({ instanceName, groups }: { instanceName: string; groups: RemoteGroup[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const resp = await fetch(apiUrl("groups/select-groups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, userId: user.id, instanceName, groups }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-selected"] });
      toast({ title: "Grupos adicionados!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao adicionar grupos", description: err.message, variant: "destructive" });
    },
  });

  const removeGroup = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(apiUrl(`groups/selected-groups/${id}`), { method: "DELETE" });
      if (!resp.ok) throw new Error(await resp.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-selected"] });
      toast({ title: "Grupo removido!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  return { selectedGroups, isLoading, fetchGroups, addGroups, removeGroup };
}
