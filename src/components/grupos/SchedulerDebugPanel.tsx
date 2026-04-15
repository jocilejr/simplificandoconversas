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

/* ─── Horizontal Card ─── */
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
  const reasonTitle = failedCount > 0 ? (msg.failure_reason || msg.queue_error_summary[0]?.reason_label || null) : null;

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
      style={!isCurrent ? { filter: "blur(2px)" } : undefined}
    >
      <div
        className={`h-full rounded-2xl overflow-hidden flex flex-row transition-all duration-500`}
        style={{
          background: 'hsl(var(--card))',
          boxShadow: isCurrent
            ? '0 20px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 8px 30px -8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* LEFT — Info */}
        <div className="flex flex-col justify-between flex-1 min-w-0 p-4">
          {/* Top info */}
          <div className="space-y-2">
            {/* Time */}
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-bold font-mono leading-none tracking-tight ${
                isPast ? "text-muted-foreground" : "text-foreground"
              }`}>
                {formatTimeBrt(runAt)}
              </span>
              <span className="text-[11px] text-muted-foreground/50">{formatDateBrt(runAt)}</span>
            </div>

            {/* Campaign name */}
            <div className="flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <p className="text-sm font-semibold truncate flex-1">{msg.campaign_name}</p>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 border-border/30 font-medium">
                <StatusIcon className="h-3 w-3" />{msg.status_label}
              </Badge>
            </div>

            {/* Type + Schedule */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5 h-5">
                <Icon className="h-3 w-3" />{typeLabels[msg.message_type] || msg.message_type}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 border-border/20">
                <CalendarClock className="h-3 w-3 mr-0.5" />
                {scheduleLabels[msg.schedule_type] || msg.schedule_type}
              </Badge>
            </div>

            {/* Error reason */}
            {reasonTitle && failedCount > 0 && (
              <p className="text-[10px] text-destructive/80 leading-tight line-clamp-2">{reasonTitle}</p>
            )}
          </div>

          {/* Bottom stats — colored individually */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400 leading-none">{sentCount}</span>
              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-medium">env.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UsersRound className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-bold text-primary leading-none">{msg.target_groups_count}</span>
              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-medium">grupos</span>
            </div>
            {failedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-sm font-bold text-destructive leading-none">{failedCount}</span>
                <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-medium">falhas</span>
              </div>
            )}
            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-sm font-bold text-amber-400 leading-none">{pendingCount}</span>
                <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-medium">pend.</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Preview */}
        <div className="w-[42%] shrink-0 relative" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="absolute inset-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <WhatsAppPreview {...previewProps} />
          </div>
          {/* Top fade */}
          <div
            className="absolute top-0 left-0 right-0 h-6 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to bottom, rgba(11,20,26,0.6), transparent)' }}
          />
          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to top, hsl(var(--card)), transparent)' }}
          />
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
                style={{ height: "280px" }}
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
