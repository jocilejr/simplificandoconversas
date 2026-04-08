import { Play, XCircle, RefreshCw, Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/transactions/StatCard";
import { useGroupQueue } from "@/hooks/useGroupQueue";
import { format } from "date-fns";

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", label: "Pendente" },
  processing: { color: "bg-blue-500/10 text-blue-500 border-blue-500/30", label: "Enviando" },
  sent: { color: "bg-green-500/10 text-green-500 border-green-500/30", label: "Enviada" },
  failed: { color: "bg-red-500/10 text-red-500 border-red-500/30", label: "Falha" },
  cancelled: { color: "bg-muted text-muted-foreground border-border/50", label: "Cancelada" },
};

export default function GroupQueueTab() {
  const { queueItems, isLoading, processQueue, cancelBatch, stats } = useGroupQueue();

  const batches = [...new Set(
    queueItems
      .filter((i: any) => i.execution_batch && i.status === "pending")
      .map((i: any) => i.execution_batch)
  )];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Pendentes" value={String(stats.pending)} icon={Clock} iconColor="text-yellow-500" />
        <StatCard title="Processando" value={String(stats.processing)} icon={Loader2} iconColor="text-blue-500" />
        <StatCard title="Enviadas" value={String(stats.sent)} icon={CheckCircle2} iconColor="text-green-500" />
        <StatCard title="Falhas" value={String(stats.failed)} icon={AlertCircle} iconColor="text-red-500" />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => processQueue.mutate()} disabled={processQueue.isPending || stats.pending === 0}>
          <Play className="h-3.5 w-3.5 mr-1" />
          Processar ({stats.pending})
        </Button>
        {batches.map((b: string) => (
          <Button key={b} variant="outline" size="sm" onClick={() => cancelBatch.mutate(b)}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar batch
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Fila de Envio
            {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          {queueItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Fila vazia.</p>
          ) : (
            <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
              {queueItems.map((item: any) => {
                const cfg = statusConfig[item.status] || statusConfig.pending;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 transition-colors">
                    <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium">{item.group_name || item.group_jid}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.instance_name} · {item.message_type}
                      </p>
                    </div>
                    {item.error_message && (
                      <span className="text-[10px] text-red-500 truncate max-w-[200px]">{item.error_message}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {format(new Date(item.created_at), "HH:mm")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
