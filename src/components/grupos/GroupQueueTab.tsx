import { useState, useEffect } from "react";
import { XCircle, RefreshCw, Clock, Loader2, CheckCircle2, AlertCircle, Shield, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/transactions/StatCard";
import { useGroupQueue, useSpamConfig } from "@/hooks/useGroupQueue";
import { format } from "date-fns";

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", label: "Pendente" },
  processing: { color: "bg-blue-500/10 text-blue-500 border-blue-500/30", label: "Enviando" },
  sent: { color: "bg-green-500/10 text-green-500 border-green-500/30", label: "Enviada" },
  failed: { color: "bg-red-500/10 text-red-500 border-red-500/30", label: "Falha" },
  cancelled: { color: "bg-muted text-muted-foreground border-border/50", label: "Cancelada" },
};

export default function GroupQueueTab() {
  const { queueItems, isLoading, cancelBatch, stats } = useGroupQueue();
  const { config, isLoading: configLoading, updateConfig } = useSpamConfig();

  const [maxPerGroup, setMaxPerGroup] = useState(3);
  const [perMinutes, setPerMinutes] = useState(60);
  const [delayMs, setDelayMs] = useState(3000);

  useEffect(() => {
    if (config) {
      setMaxPerGroup(config.max_messages_per_group);
      setPerMinutes(config.per_minutes);
      setDelayMs(config.delay_between_sends_ms);
    }
  }, [config]);

  const batches = [...new Set(
    queueItems
      .filter((i: any) => i.execution_batch && i.status === "pending")
      .map((i: any) => i.execution_batch)
  )];

  const handleSaveConfig = () => {
    updateConfig.mutate({
      maxMessagesPerGroup: maxPerGroup,
      perMinutes: perMinutes,
      delayBetweenSendsMs: delayMs,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Pendentes" value={String(stats.pending)} icon={Clock} iconColor="text-yellow-500" />
        <StatCard title="Processando" value={String(stats.processing)} icon={Loader2} iconColor="text-blue-500" />
        <StatCard title="Enviadas" value={String(stats.sent)} icon={CheckCircle2} iconColor="text-primary" />
        <StatCard title="Falhas" value={String(stats.failed)} icon={AlertCircle} iconColor="text-red-500" />
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Anti-Spam</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Máx. mensagens por grupo</Label>
                <Input type="number" min={1} max={50} value={maxPerGroup} onChange={(e) => setMaxPerGroup(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground">Limite na janela de tempo</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Janela de tempo (min)</Label>
                <Input type="number" min={1} max={1440} value={perMinutes} onChange={(e) => setPerMinutes(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground">Período do limite</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Delay entre envios (ms)</Label>
                <Input type="number" min={1000} max={60000} step={500} value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground">Intervalo entre mensagens</p>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={handleSaveConfig} disabled={updateConfig.isPending || configLoading}>
                <Save className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {batches.length > 0 && (
        <div className="flex gap-2">
          {batches.map((b: string) => (
            <Button key={b} variant="outline" size="sm" className="border-border/50" onClick={() => cancelBatch.mutate(b)}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar batch
            </Button>
          ))}
        </div>
      )}

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fila de Envio</p>
            {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {queueItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Fila vazia.</p>
          ) : (
            <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
              {queueItems.map((item: any) => {
                const cfg = statusConfig[item.status] || statusConfig.pending;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
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
