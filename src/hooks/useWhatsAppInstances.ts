import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: string;
  is_active: boolean;
  proxy_url: string | null;
  message_delay_ms: number;
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
  const { workspaceId } = useWorkspace();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WhatsAppInstance[];
    },
  });

  const {
    data: remoteData,
    isError: isServerError,
    isLoading: isRemoteLoading,
  } = useQuery({
    queryKey: ["whatsapp-remote-instances"],
    staleTime: 30_000,
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
          body: { action: "fetch-instances", workspaceId },
        });
      // Detect stub response from edge function error or data content
      if (error) {
        // Edge function 503 = self-hosted backend not available
        return "stub" as const;
      }
      if (data?.error?.includes?.("self-hosted") || data?.info?.includes?.("VPS")) {
        return "stub" as const;
      }
      const list = Array.isArray(data) ? data : data?.instances || [];
      return list.map(parseRemoteInstance) as RemoteInstance[];
    },
    staleTime: 30_000,
    refetchInterval: (query) => {
      if (query.state.data === "stub") return false;
      return 10000;
    },
    retry: 0,
  });

  const remoteInstances = (remoteData && remoteData !== "stub") ? remoteData : [];
  const isStubResponse = remoteData === "stub";
  const isServerConnected = !isServerError && remoteData !== undefined && !isStubResponse;

  const mergedInstances = instances.map((inst) => {
    const remote = remoteInstances.find((ri) => ri.name === inst.instance_name);
    return {
      ...inst,
      status: remote?.status || inst.status,
      profileName: remote?.profileName || "",
    };
  });

  const createInstance = useMutation({
    mutationFn: async (customName: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "create-instance", instanceName: customName },
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

  const getQrCode = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "get-qrcode", instanceName },
      });
      if (error) throw error;
      return data;
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao obter QR Code", description: err.message, variant: "destructive" });
    },
  });

  const connectInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "connect-instance", instanceName },
      });
      if (error) throw error;
      return data;
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    },
  });

  const logoutInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "logout-instance", instanceName },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-remote-instances"] });
      toast({ title: "Reconexão iniciada! Escaneie o novo QR Code." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao reconectar", description: err.message, variant: "destructive" });
    },
  });

  const deleteInstance = useMutation({
    mutationFn: async (instanceName: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "delete-instance", instanceName },
      });
      await supabase.from("whatsapp_instances").delete().eq("instance_name", instanceName);
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
      if (!workspaceId) throw new Error("Workspace não selecionado");

      await supabase
        .from("whatsapp_instances")
        .upsert({
          user_id: user.id,
          workspace_id: workspaceId,
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

  const updateDelay = useMutation({
    mutationFn: async ({ instanceName, delayMs }: { instanceName: string; delayMs: number }) => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ message_delay_ms: delayMs } as any)
        .eq("instance_name", instanceName);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({ title: "Intervalo atualizado!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar intervalo", description: err.message, variant: "destructive" });
    },
  });

  return {
    instances: mergedInstances,
    remoteInstances,
    isLoading,
    isRemoteLoading,
    isServerConnected,
    createInstance,
    getQrCode,
    connectInstance,
    logoutInstance,
    deleteInstance,
    setActiveInstance,
    updateDelay,
  };
}
