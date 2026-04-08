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

  const processQueue = useMutation({
    mutationFn: async () => {
      const resp = await fetch(apiUrl("groups/queue/process"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["group-queue"] });
      toast({ title: `Processado: ${data.sent} enviados, ${data.failed} falhas` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao processar fila", description: err.message, variant: "destructive" });
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

  const stats = {
    pending: queueItems.filter((i: any) => i.status === "pending").length,
    processing: queueItems.filter((i: any) => i.status === "processing").length,
    sent: queueItems.filter((i: any) => i.status === "sent").length,
    failed: queueItems.filter((i: any) => i.status === "failed").length,
  };

  return { queueItems, isLoading, processQueue, cancelBatch, stats };
}
