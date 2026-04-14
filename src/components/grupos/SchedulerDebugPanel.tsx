import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  RefreshCw, Clock, Timer, AlertTriangle, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, FileText, Image, Mic, File, Send
} from "lucide-react";
import { useSchedulerDebug, type ScheduledMessageDebug } from "@/hooks/useSchedulerDebug";

type Filter = "all" | "future" | "past" | "problems";

const typeIcons: Record<string, typeof FileText> = {
  text: FileText, image: Image, audio: Mic, file: File,
};

const statusColors: Record<string, string> = {
  sent: "text-green-500 bg-green-500/10 border-green-500/30",
  failed: "text-red-500 bg-red-500/10 border-red-500/30",
  pending: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  processing: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  cancelled: "text-muted-foreground bg-muted/30 border-border/50",
};

function formatBrt(utcStr: string | null): string {
  if (!utcStr) return "—";
  const d = new Date(utcStr);
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

function formatBrtFull(utcStr: string | null): string {
  if (!utcStr) return "—";
  const d = new Date(utcStr);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" });
}

function timeDiffStr(startStr: string | null, endStr: string | null): string {
  if (!startStr || !endStr) return "—";
  const diffMs = new Date(endStr).getTime() - new Date(startStr).getTime();
  if (diffMs < 1000) return `${diffMs}ms`;
  if (diffMs < 60000) return `${(diffMs / 1000).toFixed(1)}s`;
  return `${(diffMs / 60000).toFixed(1)}min`;
}

function getTimerBadge(msg: ScheduledMessageDebug, isPast: boolean) {
  if (msg.missed) {
    return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10 text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Perdida</Badge>;
  }
  if (isPast) {
    const allSent = msg.queue_items.length > 0 && msg.queue_items.every(qi => qi.status === "sent");
    const anyFailed = msg.queue_items.some(qi => qi.status === "failed");
    if (anyFailed) return <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 text-[10px] gap-1"><XCircle className="h-3 w-3" />Falhou</Badge>;
    if (allSent) return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Enviada</Badge>;
    if (msg.queue_items.length === 0) return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10 text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Sem fila</Badge>;
    return <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10 text-[10px] gap-1"><Clock className="h-3 w-3" />Processando</Badge>;
  }
  if (msg.has_timer) return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-[10px] gap-1"><Timer className="h-3 w-3" />Timer ativo</Badge>;
  return <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 text-[10px] gap-1"><XCircle className="h-3 w-3" />Sem timer</Badge>;
}

function MessageRow({ msg }: { msg: ScheduledMessageDebug }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const nextRun = msg.next_run_at ? new Date(msg.next_run_at) : null;
  const isPast = nextRun ? nextRun < now : true;

  const Icon = typeIcons[msg.message_type] || FileText;
  const sentCount = msg.queue_items.filter(qi => qi.status === "sent").length;
  const failedCount = msg.queue_items.filter(qi => qi.status === "failed").length;
  const pendingCount = msg.queue_items.filter(qi => qi.status === "pending" || qi.status === "processing").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors border-b border-border/20 ${isPast ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-1.5 w-16 shrink-0">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className={`text-sm font-mono font-semibold ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
              {formatBrt(msg.next_run_at)}
            </span>
          </div>

          <Badge variant="outline" className="text-[10px] gap-1 border-border/50 shrink-0">
            <Icon className="h-3 w-3" />{msg.message_type}
          </Badge>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{msg.campaign_name}</p>
            <p className="text-xs truncate text-muted-foreground/70">{msg.content_preview}</p>
          </div>

          {getTimerBadge(msg, isPast)}

          {msg.queue_items.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              {sentCount > 0 && <span className="text-[10px] text-green-500 font-medium">{sentCount}✓</span>}
              {failedCount > 0 && <span className="text-[10px] text-red-500 font-medium">{failedCount}✗</span>}
              {pendingCount > 0 && <span className="text-[10px] text-yellow-500 font-medium">{pendingCount}⏳</span>}
            </div>
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="bg-muted/10 px-4 py-3 border-b border-border/20">
          <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
            <div><span className="text-muted-foreground">ID: </span><span className="font-mono">{msg.id.slice(0, 8)}</span></div>
            <div><span className="text-muted-foreground">Tipo: </span>{msg.schedule_type}</div>
            <div><span className="text-muted-foreground">next_run_at: </span>{formatBrtFull(msg.next_run_at)}</div>
            <div><span className="text-muted-foreground">last_run_at: </span>{formatBrtFull(msg.last_run_at)}</div>
            <div><span className="text-muted-foreground">Timer: </span>{msg.has_timer ? "✅ Ativo" : "❌ Ausente"}</div>
            <div><span className="text-muted-foreground">Missed: </span>{msg.missed ? "⚠️ Sim" : "Não"}</div>
          </div>

          {msg.queue_items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum item na fila para esta execução.</p>
          ) : (
            <div className="border border-border/30 rounded-md overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px_60px_1fr] gap-0 text-[10px] font-medium text-muted-foreground bg-muted/30 px-2 py-1.5">
                <span>Grupo</span>
                <span>Status</span>
                <span>Na fila</span>
                <span>Início</span>
                <span>Concluído</span>
                <span>Tempo</span>
                <span>Erro</span>
              </div>
              {msg.queue_items.map((qi, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_80px_60px_1fr] gap-0 text-[10px] px-2 py-1.5 border-t border-border/20 hover:bg-muted/10">
                  <span className="truncate" title={qi.group_jid}>
                    {qi.group_name || qi.group_jid.split("@")[0].slice(0, 20)}
                  </span>
                  <span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${statusColors[qi.status] || ""}`}>
                      {qi.status}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground">{formatBrt(qi.created_at)}</span>
                  <span className="text-muted-foreground">{formatBrt(qi.started_at)}</span>
                  <span className="text-muted-foreground">{formatBrt(qi.completed_at)}</span>
                  <span className="text-muted-foreground">{timeDiffStr(qi.created_at, qi.completed_at)}</span>
                  <span className="text-red-400 truncate" title={qi.error_message || undefined}>{qi.error_message || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function SchedulerDebugPanel() {
  const { data, isLoading, refresh } = useSchedulerDebug();
  const [filter, setFilter] = useState<Filter>("all");

  const now = new Date();

  const filtered = (data?.messages || []).filter(msg => {
    if (filter === "all") return true;
    const nextRun = msg.next_run_at ? new Date(msg.next_run_at) : null;
    const isPast = nextRun ? nextRun < now : true;
    if (filter === "future") return !isPast;
    if (filter === "past") return isPast;
    if (filter === "problems") return msg.missed || !msg.has_timer || msg.queue_items.some(qi => qi.status === "failed");
    return true;
  });

  const problemCount = (data?.messages || []).filter(m => m.missed || (!m.has_timer && m.next_run_at && new Date(m.next_run_at) > now) || m.queue_items.some(qi => qi.status === "failed")).length;

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "Todas", count: data?.messages?.length || 0 },
    { key: "future", label: "Futuras", count: (data?.messages || []).filter(m => m.next_run_at && new Date(m.next_run_at) > now).length },
    { key: "past", label: "Passadas", count: (data?.messages || []).filter(m => !m.next_run_at || new Date(m.next_run_at) <= now).length },
    { key: "problems", label: "Problemas", count: problemCount },
  ];

  return (
    <Card className="border-border/50">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scheduler Debug — Hoje</p>
            {data && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{data.timers_active} timers</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{data.server_time_brt} BRT</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} className="h-7 text-xs gap-1">
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-border/30 flex gap-1.5">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                filter === f.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/30"
              } ${f.key === "problems" && (f.count || 0) > 0 ? "text-red-500" : ""}`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Messages list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {filter === "problems" ? "Nenhum problema detectado. 🎉" : "Nenhuma publicação para hoje."}
          </p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.map(msg => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
          </div>
        )}

        {/* Summary footer */}
        {data && data.messages.length > 0 && (
          <div className="px-4 py-2 border-t border-border/30 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Send className="h-3 w-3" />{data.messages.reduce((sum, m) => sum + m.queue_items.filter(qi => qi.status === "sent").length, 0)} enviadas</span>
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />{data.messages.reduce((sum, m) => sum + m.queue_items.filter(qi => qi.status === "failed").length, 0)} falhas</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-500" />{data.messages.filter(m => m.missed).length} perdidas</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
