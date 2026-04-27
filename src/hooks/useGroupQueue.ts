import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";

export function useGroupQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: queueItems = [], isLoading } = useQuery({
    queryKey: ["group-queue", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 5000,
    queryFn: async () => {
      const resp = await fetch(apiUrl(`groups/queue-status?workspaceId=${workspaceId}`));
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
  });

  const cancelBatch = useMutation({
    mutationFn: async (batch: string) => {
      const resp = await fetch(apiUrl("groups/queue/cancel-batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-queue"] });
      toast({ title: "Batch cancelado!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" });
    },
  });

  const retryBatch = useMutation({
    mutationFn: async (batch: string) => {
      const resp = await fetch(apiUrl("groups/queue/retry-batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch, workspaceId }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["group-queue"] });
      toast({ title: `${data?.retried ?? 0} item(s) reenviado(s) para fila!` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao reenviar", description: err.message, variant: "destructive" });
    },
  });

  const clearQueue = useMutation({
    mutationFn: async (filter: "sent" | "failed" | "sent_failed" | "all") => {
      const resp = await fetch(apiUrl("groups/queue/clear"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, filter }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-queue"] });
      toast({ title: "Fila limpa com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao limpar", description: err.message, variant: "destructive" });
    },
  });

  const stats = {
    pending: queueItems.filter((i: any) => i.status === "pending").length,
    processing: queueItems.filter((i: any) => i.status === "processing").length,
    sent: queueItems.filter((i: any) => i.status === "sent").length,
    failed: queueItems.filter((i: any) => i.status === "failed").length,
    cancelled: queueItems.filter((i: any) => i.status === "cancelled").length,
  };

  return { queueItems, isLoading, cancelBatch, retryBatch, clearQueue, stats };
}

export function useSpamConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: config, isLoading } = useQuery({
    queryKey: ["spam-config", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const resp = await fetch(apiUrl(`groups/spam-config?workspaceId=${workspaceId}`));
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (params: {
      maxMessagesPerGroup?: number;
      perMinutes?: number;
      delayBetweenSendsMs?: number;
    }) => {
      const resp = await fetch(apiUrl("groups/spam-config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...params }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spam-config", workspaceId] });
      toast({ title: "Configuração anti-spam salva!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  return {
    config: config || { max_messages_per_group: 3, per_minutes: 60, delay_between_sends_ms: 3000 },
    isLoading,
    updateConfig,
  };
}
