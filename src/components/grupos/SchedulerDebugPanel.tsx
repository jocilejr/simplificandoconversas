import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Clock, Timer, AlertTriangle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, FileText, Image, Mic, File, Video,
  Send, UsersRound, CalendarClock, Megaphone,
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

const statusConfig: Record<string, { color: string; bg: string; border: string; icon: typeof Clock }> = {
  waiting: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: Timer },
  processing: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Clock },
  sent: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2 },
  failed: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: XCircle },
  missed: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertTriangle },
  skipped: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: AlertTriangle },
};

/* ─── Card ─── */
function ScheduleCard({
  msg, position, currentTimeMs,
}: {
  msg: ScheduledMessageDebug | null;
  position: "prev" | "current" | "next";
  currentTimeMs: number;
}) {
  if (!msg) {
    return <div className="flex-1 min-w-0 transition-all duration-500 ease-out opacity-0" />;
  }

  const runAt = getMessageRunAt(msg);
  const nextRun = runAt ? new Date(runAt) : null;
  const isPast = nextRun ? nextRun.getTime() < currentTimeMs : true;
  const isCurrent = position === "current";

  const Icon = typeIcons[msg.message_type] || FileText;
  const cfg = statusConfig[msg.status_code] || statusConfig.waiting;
  const StatusIcon = cfg.icon;

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
    compact: true,
  };

  return (
    <div
      className={`flex-1 min-w-0 transition-all duration-500 ease-out ${
        isCurrent
          ? "scale-100 opacity-100 z-10"
          : "scale-[0.93] opacity-45 z-0"
      }`}
      style={!isCurrent ? { filter: "blur(1.5px)" } : undefined}
    >
      <div className={`h-full rounded-2xl overflow-hidden transition-all duration-500 ${
        isCurrent
          ? "border border-primary/30 ring-1 ring-white/5 shadow-2xl shadow-black/20 bg-card"
          : "border border-border/15 bg-card/50"
      }`}>
        <div className="flex h-full min-h-0">
          {/* LEFT — 42% */}
          <div className="flex flex-col w-[42%] min-w-0">
            {/* Time + Status header */}
            <div className="px-3.5 py-2.5 border-b border-border/10">
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-xl font-bold font-mono leading-none tracking-tight ${
                    isPast ? "text-muted-foreground" : isCurrent ? "text-primary" : "text-foreground"
                  }`}>
                    {formatTimeBrt(runAt)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">{formatDateBrt(runAt)}</span>
                </div>
                <Badge variant="outline" className={`${cfg.color} ${cfg.bg} ${cfg.border} text-[9px] gap-0.5 shrink-0 px-1.5 py-0 h-[18px]`}>
                  <StatusIcon className="h-3 w-3" />{msg.status_label}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 py-0 h-4">
                  <Icon className="h-2.5 w-2.5" />{typeLabels[msg.message_type] || msg.message_type}
                </Badge>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border/20">
                  <CalendarClock className="h-2.5 w-2.5 mr-0.5" />
                  {scheduleLabels[msg.schedule_type] || msg.schedule_type}
                </Badge>
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 space-y-2 scrollbar-none">
              <div className="flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <p className="text-xs font-medium truncate leading-tight">{msg.campaign_name}</p>
              </div>

              <div className="flex items-center gap-2">
                <UsersRound className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <p className="text-xs text-muted-foreground leading-tight">
                  {msg.target_groups_count} grupo{msg.target_groups_count !== 1 ? "s" : ""}
                </p>
              </div>

              {(sentCount > 0 || failedCount > 0) && (
                <div className="flex items-center gap-3 pt-0.5">
                  {sentCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />{sentCount}
                    </span>
                  )}
                  {failedCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-red-400">
                      <XCircle className="h-3 w-3" />{failedCount}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Diagnostic footer */}
            {reasonTitle && (
              <div className="px-3.5 py-2 border-t border-border/10 bg-destructive/5">
                <p className="text-[9px] font-medium leading-tight text-destructive/80 line-clamp-2">{reasonTitle}</p>
              </div>
            )}
          </div>

          {/* RIGHT — 58% preview */}
          <div className="w-[58%] min-w-0 border-l border-border/10 overflow-hidden">
            <div className="h-full overflow-y-auto scrollbar-none">
              <WhatsAppPreview {...previewProps} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main panel ─── */
export default function SchedulerDebugPanel() {
  const { data, isLoading, refresh } = useSchedulerDebug();
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  const navigate = useCallback((dir: "prev" | "next") => {
    if (isTransitioning) return;
    const newIdx = dir === "prev"
      ? Math.max(activeIndex - 1, 0)
      : Math.min(activeIndex + 1, sorted.length - 1);
    if (newIdx === activeIndex) return;
    setIsTransitioning(true);
    setActiveIndex(newIdx);
    setTimeout(() => setIsTransitioning(false), 400);
  }, [activeIndex, sorted.length, isTransitioning]);

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
        <div className="px-4 py-2 border-b border-border/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Publicações de Hoje
            </p>
            {data && (
              <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground/70">
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />{data.timers_active}
                </span>
                <span className="flex items-center gap-1">
                  <UsersRound className="h-3 w-3" />{data.groups_count}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sorted.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                {Array.from({ length: Math.min(sorted.length, 12) }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === activeIndex ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"
                    }`}
                  />
                ))}
                {sorted.length > 12 && (
                  <span className="ml-1 text-[9px]">+{sorted.length - 12}</span>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={refresh} className="h-6 w-6 p-0">
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stage */}
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma publicação agendada para hoje.
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-hidden px-2 py-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate("prev")}
                disabled={!canPrev}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-border/30 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:bg-muted/50 hover:border-border/60 disabled:opacity-0 disabled:pointer-events-none"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <div
                className="flex flex-1 min-w-0 gap-2 items-stretch"
                style={{ height: "280px" }}
              >
                <ScheduleCard key={prev?.id || "ghost-prev"} msg={prev} position="prev" currentTimeMs={currentTimeMs} />
                <ScheduleCard key={current?.id || "ghost-current"} msg={current} position="current" currentTimeMs={currentTimeMs} />
                <ScheduleCard key={next?.id || "ghost-next"} msg={next} position="next" currentTimeMs={currentTimeMs} />
              </div>

              <button
                onClick={() => navigate("next")}
                disabled={!canNext}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-border/30 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:bg-muted/50 hover:border-border/60 disabled:opacity-0 disabled:pointer-events-none"
                aria-label="Próximo"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {data && messages.length > 0 && (
          <div className="px-4 py-1.5 border-t border-border/30 flex items-center gap-4 text-[10px] text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <Send className="h-2.5 w-2.5" />{totalSent} enviadas
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-2.5 w-2.5 text-red-400/70" />{totalFailed} falhas
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5 text-amber-400/70" />{totalMissed} perdidas
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
