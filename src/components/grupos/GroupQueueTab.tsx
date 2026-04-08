import { Play, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGroupQueue } from "@/hooks/useGroupQueue";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  sent: "bg-green-500/10 text-green-600 border-green-500/30",
  failed: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

export default function GroupQueueTab() {
  const { queueItems, isLoading, processQueue, cancelBatch, stats } = useGroupQueue();

  const batches = [...new Set(queueItems.filter((i: any) => i.execution_batch && i.status === "pending").map((i: any) => i.execution_batch))];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pendentes", value: stats.pending, color: "text-yellow-500" },
          { label: "Processando", value: stats.processing, color: "text-blue-500" },
          { label: "Enviadas", value: stats.sent, color: "text-green-500" },
          { label: "Falhas", value: stats.failed, color: "text-red-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => processQueue.mutate()} disabled={processQueue.isPending || stats.pending === 0}>
          <Play className="h-4 w-4 mr-1" />
          Processar Fila ({stats.pending})
        </Button>
      {batches.map((b: string) => (
          <Button key={b} variant="outline" size="sm" onClick={() => cancelBatch.mutate(b)}>
            <XCircle className="h-4 w-4 mr-1" /> Cancelar batch
          </Button>
        ))}
      </div>

      {/* Queue items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Fila de Envio
            {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queueItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Fila vazia.</p>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {queueItems.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                  <Badge variant="outline" className={statusColors[item.status] || ""}>
                    {item.status}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{item.group_name || item.group_jid}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.instance_name} · {item.message_type}
                    </p>
                  </div>
                  {item.error_message && (
                    <span className="text-xs text-red-500 truncate max-w-[200px]">{item.error_message}</span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(item.created_at), "HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
