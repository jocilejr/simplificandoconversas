import { useRef, useEffect, useMemo, useState } from "react";
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

function getMessageRunAt(msg: ScheduledMessageDebug): string | null {
  return msg.effective_run_at || msg.next_run_at || msg.last_run_at;
}

const typeIcons: Record<string, typeof FileText> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: Mic,
  file: File,
  document: File,
};

const typeLabels: Record<string, string> = {
  text: "Texto",
  image: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
  file: "Arquivo",
  document: "Documento",
};

const statusClasses: Record<ScheduledMessageDebug["status_code"], string> = {
  waiting: "text-green-500 border-green-500/30 bg-green-500/10",
  processing: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  sent: "text-green-500 border-green-500/30 bg-green-500/10",
  failed: "text-red-500 border-red-500/30 bg-red-500/10",
  missed: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
  skipped: "text-orange-500 border-orange-500/30 bg-orange-500/10",
};

const statusIcons = {
  waiting: Timer,
  processing: Clock,
  sent: CheckCircle2,
  failed: XCircle,
  missed: AlertTriangle,
  skipped: AlertTriangle,
} satisfies Record<ScheduledMessageDebug["status_code"], typeof Clock>;

/* ─── status badge ─── */
function StatusBadge({ msg }: { msg: ScheduledMessageDebug }) {
  const Icon = statusIcons[msg.status_code] || Clock;
  return (
    <Badge variant="outline" className={`${statusClasses[msg.status_code]} text-[10px] gap-1`}>
      <Icon className="h-3 w-3" />{msg.status_label}
    </Badge>
  );
}

/* ─── single card ─── */
function ScheduleCard({
  msg,
  isActive,
  currentTimeMs,
}: {
  msg: ScheduledMessageDebug;
  isActive: boolean;
  currentTimeMs: number;
}) {
  const runAt = getMessageRunAt(msg);
  const nextRun = runAt ? new Date(runAt) : null;
  const isPast = nextRun ? nextRun.getTime() < currentTimeMs : true;

  const Icon = typeIcons[msg.message_type] || FileText;
  const sentCount = msg.queue_items.filter(qi => qi.status === "sent").length;
  const failedCount = msg.queue_items.filter(qi => qi.status === "failed").length;
  const primaryQueueError = msg.queue_error_summary[0];
  const reasonTitle = msg.failure_reason || primaryQueueError?.reason_label || "Sem diagnóstico";
  const reasonDetails = msg.failure_details || primaryQueueError?.reason_details || "O backend ainda não informou detalhes adicionais para esta publicação.";

  // Map content to WhatsAppPreview props
  const content = msg.content || {};
  const previewProps = {
    messageType: msg.message_type,
    textContent: content.text || content.caption || "",
    mediaUrl: content.mediaUrl || content.audioUrl || "",
    caption: content.caption || "",
    mentionAll: content.mentionAll || false,
    forceLinkPreview: content.forceLinkPreview,
  };

  // For text with caption only, use text as textContent
  if (msg.message_type === "text") {
    previewProps.textContent = content.text || content.caption || msg.content_preview || "";
  }

  const borderClass = isActive
    ? "ring-2 ring-primary/60 border-primary/40"
    : msg.status_code === "missed"
      ? "border-yellow-500/30 opacity-80"
      : msg.status_code === "failed"
        ? "border-red-500/30 opacity-70"
      : msg.status_code === "sent"
        ? "border-green-500/30 opacity-60"
      : isPast
      ? sentCount > 0 && failedCount === 0
        ? "border-green-500/30 opacity-60"
        : failedCount > 0
          ? "border-red-500/30 opacity-60"
          : "border-border/30 opacity-50"
      : "border-border/40";

  return (
    <div
      data-scheduler-card
      className={`flex h-[380px] flex-shrink-0 w-[260px] min-w-[260px] snap-center rounded-xl border bg-card overflow-hidden ${borderClass}`}
      style={{ scrollSnapAlign: "center" }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Card header */}
      <div className="px-2.5 py-2 border-b border-border/30 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold font-mono ${isPast ? "text-muted-foreground" : isActive ? "text-primary" : "text-foreground"}`}>
            {formatTimeBrt(runAt)}
          </span>
          <Badge variant="outline" className="text-[9px] gap-0.5 border-border/50 px-1.5 py-0">
            <Icon className="h-3 w-3" />{typeLabels[msg.message_type] || msg.message_type}
          </Badge>
        </div>
        <StatusBadge msg={msg} />
      </div>

      {/* Campaign name */}
      <div className="px-2.5 py-1 border-b border-border/20">
        <p className="text-[11px] text-muted-foreground truncate">{msg.campaign_name}</p>
      </div>

      {/* WhatsApp Preview */}
      <div className="h-[180px] min-h-[180px] overflow-y-auto">
        <WhatsAppPreview {...previewProps} />
      </div>

      <div className="min-h-[56px] border-t border-border/20 px-2.5 py-1.5 overflow-y-auto">
        <p className="text-[10px] font-medium leading-3.5">{reasonTitle}</p>
        <p className="mt-0.5 text-[9px] leading-3.5 text-muted-foreground whitespace-pre-wrap line-clamp-3">{reasonDetails}</p>
      </div>

      {/* Queue summary footer */}
      <div className="px-2.5 py-1.5 border-t border-border/30 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          {sentCount > 0 && (
            <span className="flex items-center gap-0.5 text-green-500">
              <CheckCircle2 className="h-3 w-3" />{sentCount}
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-0.5 text-red-500">
              <XCircle className="h-3 w-3" />{failedCount}
            </span>
          )}
          {sentCount === 0 && failedCount === 0 && (
            <span className="text-muted-foreground">
              {msg.status_label}
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="block text-muted-foreground font-mono text-[10px]">{msg.schedule_type}</span>
          <span className="block text-muted-foreground font-mono text-[10px]">{msg.target_groups_count} grupos</span>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ─── main panel ─── */
export default function SchedulerDebugPanel() {
  const { data, isLoading, refresh } = useSchedulerDebug();
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoCenteredIdxRef = useRef<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [activeIndex, setActiveIndex] = useState(0);

  const messages = data?.messages || [];

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTimeMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Sort by effective run time for today, not by the next recurrence in the future
  const sorted = useMemo(
    () => [...messages].sort((a, b) => {
      const aRunAt = getMessageRunAt(a);
      const bRunAt = getMessageRunAt(b);
      const aTime = aRunAt ? new Date(aRunAt).getTime() : 0;
      const bTime = bRunAt ? new Date(bRunAt).getTime() : 0;
      return aTime - bTime;
    }),
    [messages],
  );

  // Find next future message index based on the current time for today's schedule
  const nextIdx = useMemo(() => {
    const idx = sorted.findIndex((m) => {
      const runAt = getMessageRunAt(m);
      return runAt ? new Date(runAt).getTime() > currentTimeMs : false;
    });
    return idx >= 0 ? idx : sorted.length - 1;
  }, [currentTimeMs, sorted]);

  const scrollToCard = (index: number, smooth = true) => {
    const container = scrollRef.current;
    if (!container) return;

    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-scheduler-card]"));
    const targetCard = cards[index];
    if (!targetCard) return;

    const cardCenter = targetCard.offsetLeft + targetCard.offsetWidth / 2;
    const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
    const target = Math.min(Math.max(cardCenter - container.clientWidth / 2, 0), maxScrollLeft);

    if (smooth) {
      container.scrollTo({ left: target, behavior: "smooth" });
    } else {
      container.scrollLeft = target;
    }
  };

  const getClosestCardIndex = () => {
    const container = scrollRef.current;
    if (!container) return 0;

    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-scheduler-card]"));
    if (cards.length === 0) return 0;

    const viewportCenter = container.scrollLeft + container.clientWidth / 2;

    return cards.reduce((closestIdx, card, index) => {
      const closestCard = cards[closestIdx];
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const closestCenter = closestCard.offsetLeft + closestCard.clientWidth / 2;

      return Math.abs(cardCenter - viewportCenter) < Math.abs(closestCenter - viewportCenter)
        ? index
        : closestIdx;
    }, 0);
  };


  // Auto-center only when the next scheduled card actually changes
  useEffect(() => {
    if (sorted.length === 0) {
      autoCenteredIdxRef.current = null;
      setActiveIndex(0);
      return;
    }

    if (autoCenteredIdxRef.current === nextIdx) return;

    autoCenteredIdxRef.current = nextIdx;
    setActiveIndex(nextIdx);

    window.requestAnimationFrame(() => {
      scrollToCard(nextIdx, true);
    });
  }, [nextIdx, sorted.length]);

  const scroll = (dir: "left" | "right") => {
    if (sorted.length === 0) return;

    const targetIndex = dir === "left"
      ? Math.max(activeIndex - 1, 0)
      : Math.min(activeIndex + 1, sorted.length - 1);

    setActiveIndex(targetIndex);
    scrollToCard(targetIndex, true);
  };

  // Summary counters
  const totalSent = messages.filter((m) => m.status_code === "sent").length;
  const totalFailed = messages.filter((m) => m.status_code === "failed").length;
  const totalMissed = messages.filter((m) => m.status_code === "missed").length;

  return (
    <Card className="border-border/50 overflow-hidden isolate min-w-0 w-full">
      <CardContent className="p-0 overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Publicações de Hoje
            </p>
            {data && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />{data.timers_active} timers
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />{new Date(currentTimeMs).toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace("T", " ")} BRT
                </span>
                <span className="flex items-center gap-1">
                  <UsersRound className="h-3 w-3" />{data.groups_count} grupos
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {sorted.length > 0 && (
              <span className="text-[11px] text-muted-foreground mr-2">
                {sorted.length} publicações
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={refresh} className="h-7 text-xs gap-1">
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />Atualizar
            </Button>
          </div>
        </div>

        {/* Carousel */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma publicação agendada para hoje.
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-hidden">
            <div className="relative mx-auto h-[420px] w-full min-w-0 overflow-hidden" style={{ contain: "layout paint" }}>
              <button
                onClick={() => scroll("left")}
                className={`absolute left-1 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/50 bg-background/90 shadow-md transition-all hover:bg-muted/40 ${activeIndex <= 0 ? "pointer-events-none opacity-0" : "opacity-100"}`}
                aria-label="Ver programação anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={() => scroll("right")}
                className={`absolute right-1 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/50 bg-background/90 shadow-md transition-all hover:bg-muted/40 ${activeIndex >= sorted.length - 1 ? "pointer-events-none opacity-0" : "opacity-100"}`}
                aria-label="Ver próxima programação"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div
                ref={scrollRef}
                onScroll={() => {
                  const idx = getClosestCardIndex();
                  if (idx !== activeIndex) setActiveIndex(idx);
                }}
                className="flex h-full min-w-0 items-start gap-3 overflow-x-auto overflow-y-hidden scroll-smooth"
                style={{
                  scrollSnapType: "x mandatory",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  overscrollBehaviorX: "contain",
                  WebkitOverflowScrolling: "touch",
                  paddingInline: "2.5rem",
                  paddingBlock: "1rem 0.75rem",
                }}
              >
                {sorted.map((msg, idx) => (
                  <ScheduleCard key={msg.id} msg={msg} isActive={idx === activeIndex} currentTimeMs={currentTimeMs} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary footer */}
        {data && messages.length > 0 && (
          <div className="px-4 py-2 border-t border-border/30 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Send className="h-3 w-3" />{totalSent} enviadas
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />{totalFailed} falhas
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />{totalMissed} perdidas
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
