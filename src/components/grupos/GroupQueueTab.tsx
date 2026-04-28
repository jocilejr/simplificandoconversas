import { useState, useEffect } from "react";
import {
  XCircle, Clock, Loader2, CheckCircle2, AlertCircle,
  Settings2, Save, Inbox, MessageSquare, Image, FileText,
  Music, Video, Ban, Trash2, RotateCcw, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGroupQueue, useSpamConfig } from "@/hooks/useGroupQueue";
import { format } from "date-fns";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: "bg-warning/10", text: "text-warning", label: "Pendente" },
  processing: { bg: "bg-primary/10", text: "text-primary", label: "Enviando" },
  sent:       { bg: "bg-success/10", text: "text-success", label: "Enviada" },
  failed:     { bg: "bg-destructive/10", text: "text-destructive", label: "Falha" },
  cancelled:  { bg: "bg-muted", text: "text-muted-foreground", label: "Cancelada" },
};

const typeIcon: Record<string, React.ElementType> = {
  text: MessageSquare,
  image: Image,
  document: FileText,
  audio: Music,
  video: Video,
};

function StatBlock({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/60 px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function SpamConfigDialog() {
  const { config, isLoading, updateConfig } = useSpamConfig();
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

  const handleSave = () => {
    updateConfig.mutate({
      maxMessagesPerGroup: maxPerGroup,
      perMinutes,
      delayBetweenSendsMs: delayMs,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-border/50">
          <Settings2 className="h-3.5 w-3.5" />
          Configurar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Settings2 className="h-4 w-4 text-primary" />
            Configurações Anti-Spam
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
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
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending || isLoading}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GroupQueueTab() {
  const { queueItems, isLoading, cancelBatch, retryBatch, clearQueue, stats } = useGroupQueue();
  const [clearFilter, setClearFilter] = useState<"sent_failed" | "all" | null>(null);

  const cancelBatches = [...new Set(
    queueItems
      .filter((i: any) => i.execution_batch && i.status === "pending")
      .map((i: any) => i.execution_batch)
  )];

  const retryBatches = [...new Set(
    queueItems
      .filter((i: any) => i.execution_batch && (i.status === "failed" || i.status === "cancelled"))
      .map((i: any) => i.execution_batch)
  )];

  const total = queueItems.length;
  const hasClearable = stats.sent + stats.failed + stats.cancelled > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold">Fila de Envio</h3>
          {total > 0 && (
            <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
              {total} {total === 1 ? "item" : "itens"}
            </Badge>
          )}
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          {cancelBatches.map((b: string) => (
            <Button
              key={b}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
              onClick={() => cancelBatch.mutate(b)}
            >
              <Ban className="h-3 w-3" /> Cancelar batch
            </Button>
          ))}

          {retryBatches.map((b: string) => (
            <Button
              key={b}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-primary hover:text-primary hover:bg-primary/10 text-xs"
              onClick={() => retryBatch.mutate(b)}
              disabled={retryBatch.isPending}
            >
              <RotateCcw className="h-3 w-3" /> Tentar novamente
            </Button>
          ))}

          {hasClearable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-border/50 text-xs">
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setClearFilter("sent_failed")} className="text-xs gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Limpar enviados e falhos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setClearFilter("all")} className="text-xs gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar tudo (enviados, falhos, cancelados)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <SpamConfigDialog />
        </div>
      </div>

      {/* Clear confirmation dialog */}
      <AlertDialog open={!!clearFilter} onOpenChange={(open) => !open && setClearFilter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirmar limpeza</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {clearFilter === "all"
                ? "Isso removerá todos os itens enviados, com falha e cancelados da fila. Itens pendentes e em processamento serão mantidos."
                : "Isso removerá todos os itens enviados e com falha da fila."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (clearFilter) clearQueue.mutate(clearFilter);
                setClearFilter(null);
              }}
            >
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <StatBlock label="Pendentes" value={stats.pending} icon={Clock} color="bg-warning/10 text-warning" />
        <StatBlock label="Processando" value={stats.processing} icon={Loader2} color="bg-primary/10 text-primary" />
        <StatBlock label="Enviadas" value={stats.sent} icon={CheckCircle2} color="bg-success/10 text-success" />
        <StatBlock label="Falhas" value={stats.failed} icon={AlertCircle} color="bg-destructive/10 text-destructive" />
        <StatBlock label="Canceladas" value={stats.cancelled} icon={XCircle} color="bg-muted text-muted-foreground" />
      </div>

      {/* Queue List */}
      <Card className="border-border/40 overflow-hidden">
        <CardContent className="p-0">
          {queueItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Fila vazia</p>
              <p className="text-xs mt-1 opacity-70">Nenhuma mensagem agendada no momento</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 max-h-[520px] overflow-y-auto">
              {queueItems.map((item: any) => {
                const cfg = statusConfig[item.status] || statusConfig.pending;
                const TypeIcon = typeIcon[item.message_type] || MessageSquare;
                const isProcessing = item.status === "processing";
                const isRetryable = (item.status === "failed" || item.status === "cancelled") && item.execution_batch;

                return (
                  <div key={item.id} className="relative group hover:bg-muted/20 transition-colors">
                    {isProcessing && (
                      <Progress value={60} className="absolute top-0 left-0 w-full h-0.5 rounded-none bg-transparent [&>div]:bg-primary/50" />
                    )}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Icon */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary/60">
                        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.group_name || item.group_jid}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Smartphone className="h-3 w-3 text-primary/60 shrink-0" />
                          <p className="text-[11px] text-primary/70 font-medium truncate">{item.instance_name}</p>
                        </div>
                      </div>

                      {/* Error */}
                      {item.error_message && (
                        <span className="text-[10px] text-destructive truncate max-w-[180px] hidden lg:block">
                          {item.error_message}
                        </span>
                      )}

                      {/* Retry button (visible on hover for failed/cancelled) */}
                      {isRetryable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => retryBatch.mutate(item.execution_batch)}
                          disabled={retryBatch.isPending}
                          title="Tentar novamente"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Status badge */}
                      <Badge variant="outline" className={`text-[10px] border-transparent ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </Badge>

                      {/* Time */}
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-10 text-right">
                        {format(new Date(item.created_at), "HH:mm")}
                      </span>
                    </div>
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
