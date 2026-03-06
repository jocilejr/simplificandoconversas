import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EvolutionInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: string;
  is_active: boolean;
  proxy_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useEvolutionInstances() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["evolution-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evolution_instances")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as EvolutionInstance[];
    },
  });

  const fetchRemoteInstances = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "fetch-instances" },
      });
      if (error) throw error;
      return data;
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao buscar instâncias", description: err.message, variant: "destructive" });
    },
  });

  const createInstance = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "create-instance" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
      toast({ title: "Instância criada com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar instância", description: err.message, variant: "destructive" });
    },
  });

  const connectInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "connect-instance", instanceName },
      });
      if (error) throw error;
      return data;
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    },
  });

  const deleteInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "delete-instance", instanceName },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
      toast({ title: "Instância removida!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const setActiveInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase
        .from("evolution_instances")
        .upsert({
          user_id: user.id,
          instance_name: instanceName,
          is_active: true,
          status: "close",
        } as any, { onConflict: "user_id,instance_name" });

      // Configure webhook for this instance
      await supabase.functions.invoke("evolution-proxy", {
        body: { action: "set-webhook", instanceName },
      });

      // Update profile for compatibility
      await supabase
        .from("profiles")
        .update({ evolution_instance_name: instanceName })
        .eq("user_id", user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Instância ativa atualizada!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return {
    instances,
    isLoading,
    fetchRemoteInstances,
    createInstance,
    connectInstance,
    deleteInstance,
    setActiveInstance,
  };
}
