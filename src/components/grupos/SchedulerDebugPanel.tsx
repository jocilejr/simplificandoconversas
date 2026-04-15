import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Clock, Timer, AlertTriangle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, FileText, Image, Mic, File, Video,
  Send, UsersRound,
} from "lucide-react";
import { useSchedulerDebug, type ScheduledMessageDebug } from "@/hooks/useSchedulerDebug";
import WhatsAppPreview from "@/components/grupos/WhatsAppPreview";

function formatTimeBrt(utcStr: string | null): string {
  if (!utcStr) return "—";
  return new Date(utcStr).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateBrt(utcStr: string | null): string {
  if (!utcStr) return "";
  return new Date(utcStr).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

function getMessageRunAt(msg: ScheduledMessageDebug): string | null {
  return msg.effective_run_at || msg.next_run_at || msg.last_run_at;
}

const typeIcons: Record<string, typeof FileText> = {
  text: FileText, image: Image, video: Video, audio: Mic, file: File, document: File,
};

const typeLabels: Record<string, string> = {
  text: "Texto", image: "Imagem", video: "Vídeo", audio: "Áudio", file: "Arquivo", document: "Documento",
};

const scheduleLabels: Record<string, string> = {
  once: "Única", daily: "Diária", weekly: "Semanal", monthly: "Mensal", interval: "Intervalo",
};

const statusConfig: Record<string, { color: string; bg: string; border: string }> = {
  waiting: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  processing: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  sent: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  failed: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  missed: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  skipped: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
};

const statusIcons = {
  waiting: Timer, processing: Clock, sent: CheckCircle2, failed: XCircle,
  missed: AlertTriangle, skipped: AlertTriangle,
} satisfies Record<ScheduledMessageDebug["status_code"], typeof Clock>;

/* ─── Horizontal card ─── */
function ScheduleCard({
  msg, position, currentTimeMs,
}: {
  msg: ScheduledMessageDebug | null;
  position: "prev" | "current" | "next";
  currentTimeMs: number;
}) {
  if (!msg) {
    return <div className="flex-1 min-w-0" />;
  }

  const runAt = getMessageRunAt(msg);
  const nextRun = runAt ? new Date(runAt) : null;
  const isPast = nextRun ? nextRun.getTime() < currentTimeMs : true;
  const isCurrent = position === "current";

  const Icon = typeIcons[msg.message_type] || FileText;
  const StatusIcon = statusIcons[msg.status_code] || Clock;
  const cfg = statusConfig[msg.status_code] || statusConfig.waiting;

  const sentCount = msg.queue_items.filter(qi => qi.status === "sent").length;
  const failedCount = msg.queue_items.filter(qi => qi.status === "failed").length;
  const primaryQueueError = msg.queue_error_summary[0];
  const reasonTitle = msg.failure_reason || primaryQueueError?.reason_label || null;

  const content = msg.content || {};
  const previewProps = {
    messageType: msg.message_type,
    textContent: msg.message_type === "text"
      ? (content.text || content.caption || msg.content_preview || "")
      : (content.text || content.caption || ""),
    mediaUrl: content.mediaUrl || content.audioUrl || "",
    caption: content.caption || "",
    mentionAll: content.mentionAll || false,
    forceLinkPreview: content.forceLinkPreview,
  };

  return (
    <div
      className={`flex-1 min-w-0 transition-all duration-300 ${
        isCurrent ? "scale-100 opacity-100" : "scale-[0.94] opacity-50"
      }`}
      style={!isCurrent ? { filter: "blur(0.5px)" } : undefined}
    >
      <div className={`h-full rounded-xl border overflow-hidden ${
        isCurrent
          ? "border-primary/40 ring-1 ring-primary/20 bg-card shadow-lg"
          : "border-border/30 bg-card/80"
      }`}>
        {/* Horizontal layout: info left, preview right */}
        <div className="flex h-full min-h-0">
          {/* LEFT: Info */}
          <div className="flex flex-col w-[55%] min-w-0 border-r border-border/20">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-border/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-lg font-bold font-mono leading-none ${
                  isPast ? "text-muted-foreground" : isCurrent ? "text-primary" : "text-foreground"
                }`}>
                  {formatTimeBrt(runAt)}
                </span>
                <span className="text-[10px] text-muted-foreground">{formatDateBrt(runAt)}</span>
              </div>
              <Badge variant="outline" className={`${cfg.color} ${cfg.bg} ${cfg.border} text-[10px] gap-0.5 shrink-0`}>
                <StatusIcon className="h-3 w-3" />{msg.status_label}
              </Badge>
            </div>

            {/* Details */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
              {/* Type + Schedule */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                  <Icon className="h-3 w-3" />{typeLabels[msg.message_type] || msg.message_type}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/40">
                  {scheduleLabels[msg.schedule_type] || msg.schedule_type}
                </Badge>
              </div>

              {/* Campaign */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Campanha</p>
                <p className="text-xs truncate">{msg.campaign_name}</p>
              </div>

              {/* Groups */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Grupos</p>
                <p className="text-xs flex items-center gap-1">
                  <UsersRound className="h-3 w-3 text-muted-foreground" />
                  {msg.target_groups_count} grupo{msg.target_groups_count !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Queue stats */}
              <div className="flex items-center gap-3">
                {sentCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />{sentCount}
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-red-400">
                    <XCircle className="h-3 w-3" />{failedCount}
                  </span>
                )}
                {sentCount === 0 && failedCount === 0 && (
                  <span className="text-[11px] text-muted-foreground">{msg.status_label}</span>
                )}
              </div>

              {/* Diagnostic */}
              {reasonTitle && (
                <div className="mt-1 rounded-md border border-border/20 bg-muted/30 px-2 py-1.5">
                  <p className="text-[10px] font-medium leading-tight">{reasonTitle}</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Preview */}
          <div className="w-[45%] min-w-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <WhatsAppPreview {...previewProps} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── main panel ─── */
export default function SchedulerDebugPanel() {
  const { data, isLoading, refresh } = useSchedulerDebug();
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [activeIndex, setActiveIndex] = useState(0);

  const messages = data?.messages || [];

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTimeMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => {
      const aTime = getMessageRunAt(a) ? new Date(getMessageRunAt(a)!).getTime() : 0;
      const bTime = getMessageRunAt(b) ? new Date(getMessageRunAt(b)!).getTime() : 0;
      return aTime - bTime;
    }),
    [messages],
  );

  // Auto-select next upcoming message
  const nextIdx = useMemo(() => {
    const idx = sorted.findIndex((m) => {
      const runAt = getMessageRunAt(m);
      return runAt ? new Date(runAt).getTime() > currentTimeMs : false;
    });
    return idx >= 0 ? idx : Math.max(sorted.length - 1, 0);
  }, [currentTimeMs, sorted]);

  useEffect(() => {
    setActiveIndex(nextIdx);
  }, [nextIdx]);

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < sorted.length - 1;

  const prev = canPrev ? sorted[activeIndex - 1] : null;
  const current = sorted[activeIndex] || null;
  const next = canNext ? sorted[activeIndex + 1] : null;

  const totalSent = messages.filter((m) => m.status_code === "sent").length;
  const totalFailed = messages.filter((m) => m.status_code === "failed").length;
  const totalMissed = messages.filter((m) => m.status_code === "missed").length;

  return (
    <Card className="border-border/50 overflow-hidden isolate min-w-0 w-full">
      <CardContent className="p-0 overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Publicações de Hoje
            </p>
            {data && (
              <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />{data.timers_active} timers
                </span>
                <span className="flex items-center gap-1">
                  <UsersRound className="h-3 w-3" />{data.groups_count} grupos
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sorted.length > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {activeIndex + 1}/{sorted.length}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={refresh} className="h-7 text-xs gap-1 px-2">
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stage */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma publicação agendada para hoje.
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-hidden px-3 py-3">
            {/* Navigation + Stage */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => canPrev && setActiveIndex(i => i - 1)}
                disabled={!canPrev}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background/80 transition-all hover:bg-muted/40 disabled:opacity-0 disabled:pointer-events-none"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex flex-1 min-w-0 gap-3 items-stretch" style={{ height: "280px" }}>
                <ScheduleCard msg={prev} position="prev" currentTimeMs={currentTimeMs} />
                <ScheduleCard msg={current} position="current" currentTimeMs={currentTimeMs} />
                <ScheduleCard msg={next} position="next" currentTimeMs={currentTimeMs} />
              </div>

              <button
                onClick={() => canNext && setActiveIndex(i => i + 1)}
                disabled={!canNext}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background/80 transition-all hover:bg-muted/40 disabled:opacity-0 disabled:pointer-events-none"
                aria-label="Próximo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {data && messages.length > 0 && (
          <div className="px-4 py-1.5 border-t border-border/30 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Send className="h-3 w-3" />{totalSent} enviadas
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-400" />{totalFailed} falhas
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-400" />{totalMissed} perdidas
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
