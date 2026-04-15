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

const statusConfig: Record<string, { accent: string; icon: typeof Clock }> = {
  waiting: { accent: "from-emerald-500 to-emerald-600", icon: Timer },
  processing: { accent: "from-blue-500 to-blue-600", icon: Clock },
  sent: { accent: "from-emerald-500 to-emerald-600", icon: CheckCircle2 },
  failed: { accent: "from-red-500 to-red-600", icon: XCircle },
  missed: { accent: "from-amber-500 to-amber-600", icon: AlertTriangle },
  skipped: { accent: "from-orange-500 to-orange-600", icon: AlertTriangle },
};

/* ─── Vertical Card ─── */
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
  const pendingCount = msg.queue_items.filter(qi => qi.status === "pending" || qi.status === "waiting").length;
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
          : "scale-[0.93] opacity-50 z-0"
      }`}
      style={!isCurrent ? { filter: "blur(1.5px)" } : undefined}
    >
      <div
        className={`h-full rounded-2xl overflow-hidden flex flex-col transition-all duration-500 ${
          isCurrent ? "shadow-[0_8px_40px_-8px_rgba(0,0,0,0.5)]" : "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]"
        }`}
        style={{
          background: 'hsl(var(--card))',
        }}
      >
        {/* TOP — Preview (fills ~55%) */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto scrollbar-none">
            <WhatsAppPreview {...previewProps} />
          </div>
        </div>

        {/* MIDDLE — Info strip */}
        <div className="px-4 py-3 space-y-2" style={{ background: 'hsl(var(--card))' }}>
          {/* Time + Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-lg font-bold font-mono leading-none tracking-tight ${
                isPast ? "text-muted-foreground" : "text-foreground"
              }`}>
                {formatTimeBrt(runAt)}
              </span>
              <span className="text-[10px] text-muted-foreground/50">{formatDateBrt(runAt)}</span>
            </div>
            <Badge variant="outline" className={`text-[9px] gap-0.5 px-1.5 py-0 h-[18px] border-border/30`}>
              <StatusIcon className="h-3 w-3" />{msg.status_label}
            </Badge>
          </div>

          {/* Campaign + Type */}
          <div className="flex items-center gap-1.5">
            <Megaphone className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <p className="text-xs font-medium truncate flex-1">{msg.campaign_name}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 py-0 h-4">
              <Icon className="h-2.5 w-2.5" />{typeLabels[msg.message_type] || msg.message_type}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border/20">
              <CalendarClock className="h-2.5 w-2.5 mr-0.5" />
              {scheduleLabels[msg.schedule_type] || msg.schedule_type}
            </Badge>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
              <UsersRound className="h-3 w-3" />
              {msg.target_groups_count}
            </span>
          </div>

          {/* Error reason */}
          {reasonTitle && (
            <p className="text-[9px] text-destructive/80 leading-tight line-clamp-1">{reasonTitle}</p>
          )}
        </div>

        {/* BOTTOM — Stats bar with accent gradient */}
        <div className={`flex items-center justify-around px-3 py-2 bg-gradient-to-r ${cfg.accent}`}>
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-white leading-none">{sentCount}</span>
            <span className="text-[8px] text-white/70 uppercase tracking-wider mt-0.5">Enviadas</span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-white leading-none">{msg.target_groups_count}</span>
            <span className="text-[8px] text-white/70 uppercase tracking-wider mt-0.5">Grupos</span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-white leading-none">{failedCount}</span>
            <span className="text-[8px] text-white/70 uppercase tracking-wider mt-0.5">Falhas</span>
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

  return (
    <Card className="border-0 bg-transparent shadow-none overflow-hidden isolate min-w-0 w-full">
      <CardContent className="p-0 overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 py-2 flex items-center justify-between gap-2">
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
          <div className="w-full min-w-0 overflow-hidden px-3 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("prev")}
                disabled={!canPrev}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 backdrop-blur-sm transition-all duration-300 hover:bg-muted disabled:opacity-0 disabled:pointer-events-none"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div
                className="flex flex-1 min-w-0 gap-4 items-stretch"
                style={{ height: "340px" }}
              >
                <ScheduleCard key={prev?.id || "ghost-prev"} msg={prev} position="prev" currentTimeMs={currentTimeMs} />
                <ScheduleCard key={current?.id || "ghost-current"} msg={current} position="current" currentTimeMs={currentTimeMs} />
                <ScheduleCard key={next?.id || "ghost-next"} msg={next} position="next" currentTimeMs={currentTimeMs} />
              </div>

              <button
                onClick={() => navigate("next")}
                disabled={!canNext}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 backdrop-blur-sm transition-all duration-300 hover:bg-muted disabled:opacity-0 disabled:pointer-events-none"
                aria-label="Próximo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
