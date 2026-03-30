import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PlatformConnection {
  id: string;
  user_id: string;
  platform: string;
  credentials: Record<string, string>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function usePlatformConnections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["platform-connections"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("platform_connections")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return (data ?? []) as PlatformConnection[];
    },
  });

  const upsertConnection = useMutation({
    mutationFn: async ({
      platform,
      credentials,
      enabled = true,
    }: {
      platform: string;
      credentials: Record<string, string>;
      enabled?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const existing = connections.find((c) => c.platform === platform);

      if (existing) {
        const { error } = await supabase
          .from("platform_connections")
          .update({ credentials: credentials as any, enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("platform_connections")
          .insert({
            user_id: user.id,
            platform,
            credentials: credentials as any,
            enabled,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-connections"] });
      toast({ title: "Conexão salva com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar conexão", description: err.message, variant: "destructive" });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (platform: string) => {
      const existing = connections.find((c) => c.platform === platform);
      if (!existing) return;

      const { error } = await supabase
        .from("platform_connections")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-connections"] });
      toast({ title: "Conexão removida!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover conexão", description: err.message, variant: "destructive" });
    },
  });

  const getConnection = (platform: string) =>
    connections.find((c) => c.platform === platform);

  return { connections, isLoading, upsertConnection, deleteConnection, getConnection };
}
