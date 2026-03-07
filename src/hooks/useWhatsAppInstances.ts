import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: string;
  is_active: boolean;
  proxy_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemoteInstance {
  name: string;
  status: string;
  profileName?: string;
}

function parseRemoteInstance(ri: any): RemoteInstance {
  return {
    name: ri.name || ri.instanceName || ri.instance?.instanceName || "unknown",
    status: ri.connectionStatus || ri.instance?.state || ri.state || "close",
    profileName: ri.profileName || "",
  };
}

export function useWhatsAppInstances() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local DB instances
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WhatsAppInstance[];
    },
  });

  // Auto-polling remote instances from Baileys via VPS
  const {
    data: remoteData,
    isError: isServerError,
    isLoading: isRemoteLoading,
  } = useQuery({
    queryKey: ["whatsapp-remote-instances"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "fetch-instances" },
      });
      if (error) throw error;
      const list = Array.isArray(data) ? data : data?.instances || [];
      return list.map(parseRemoteInstance) as RemoteInstance[];
    },
    refetchInterval: 10000,
    retry: 1,
  });

  const remoteInstances = remoteData || [];
  const isServerConnected = !isServerError && remoteData !== undefined;

  // Merge local instances with remote status
  const mergedInstances = instances.map((inst) => {
    const remote = remoteInstances.find((ri) => ri.name === inst.instance_name);
    return {
      ...inst,
      status: remote?.status || inst.status,
      profileName: remote?.profileName || "",
    };
  });

  const createInstance = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "create-instance" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-remote-instances"] });
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
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-remote-instances"] });
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Instância ativa atualizada!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return {
    instances: mergedInstances,
    remoteInstances,
    isLoading,
    isRemoteLoading,
    isServerConnected,
    createInstance,
    connectInstance,
    deleteInstance,
    setActiveInstance,
  };
}
