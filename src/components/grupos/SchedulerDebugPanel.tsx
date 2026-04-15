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

/* ─── helpers ─── */
function toBrt(utcStr: string | null): Date | null {
  if (!utcStr) return null;
  return new Date(utcStr);
}

function formatTimeBrt(utcStr: string | null): string {
  if (!utcStr) return "—";
  return new Date(utcStr).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
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

/* ─── status badge ─── */
function StatusBadge({ msg, isPast }: { msg: ScheduledMessageDebug; isPast: boolean }) {
  if (msg.missed) {
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10 text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" />Perdida
      </Badge>
    );
  }
  if (isPast) {
    const anyFailed = msg.queue_items.some(qi => qi.status === "failed");
    const allSent = msg.queue_items.length > 0 && msg.queue_items.every(qi => qi.status === "sent");
    if (anyFailed) return (
      <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 text-[10px] gap-1">
        <XCircle className="h-3 w-3" />Falhou
      </Badge>
    );
    if (allSent) return (
      <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-[10px] gap-1">
        <CheckCircle2 className="h-3 w-3" />Enviada
      </Badge>
    );
    if (msg.queue_items.length === 0) return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10 text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" />Sem fila
      </Badge>
    );
    return (
      <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10 text-[10px] gap-1">
        <Clock className="h-3 w-3" />Processando
      </Badge>
    );
  }
  if (msg.has_timer) return (
    <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-[10px] gap-1">
      <Timer className="h-3 w-3" />Timer ativo
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 text-[10px] gap-1">
      <XCircle className="h-3 w-3" />Sem timer
    </Badge>
  );
}

/* ─── single card ─── */
function ScheduleCard({ msg, isNext }: { msg: ScheduledMessageDebug; isNext: boolean }) {
  const nextRun = msg.next_run_at ? new Date(msg.next_run_at) : null;
  const isPast = nextRun ? nextRun.getTime() < Date.now() : true;

  const Icon = typeIcons[msg.message_type] || FileText;
  const sentCount = msg.queue_items.filter(qi => qi.status === "sent").length;
  const failedCount = msg.queue_items.filter(qi => qi.status === "failed").length;

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

  const borderClass = isNext
    ? "ring-2 ring-primary/60 border-primary/40"
    : isPast
      ? sentCount > 0 && failedCount === 0
        ? "border-green-500/30 opacity-60"
        : failedCount > 0
          ? "border-red-500/30 opacity-60"
          : "border-border/30 opacity-50"
      : "border-border/40";

  return (
    <div
      className={`flex-shrink-0 w-[310px] snap-center rounded-xl border bg-card overflow-hidden flex flex-col ${borderClass}`}
      style={{ scrollSnapAlign: "center" }}
    >
      {/* Card header */}
      <div className="px-3 py-2.5 border-b border-border/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold font-mono ${isPast ? "text-muted-foreground" : isNext ? "text-primary" : "text-foreground"}`}>
            {formatTimeBrt(msg.next_run_at)}
          </span>
          <Badge variant="outline" className="text-[10px] gap-1 border-border/50">
            <Icon className="h-3 w-3" />{typeLabels[msg.message_type] || msg.message_type}
          </Badge>
        </div>
        <StatusBadge msg={msg} isPast={isPast} />
      </div>

      {/* Campaign name */}
      <div className="px-3 py-1.5 border-b border-border/20">
        <p className="text-[11px] text-muted-foreground truncate">{msg.campaign_name}</p>
      </div>

      {/* WhatsApp Preview */}
      <div className="flex-1 min-h-0 max-h-[320px] overflow-y-auto">
        <WhatsAppPreview {...previewProps} />
      </div>

      {/* Queue summary footer */}
      <div className="px-3 py-2 border-t border-border/30 flex items-center justify-between text-[11px]">
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
              {isPast ? "Sem envios" : "Aguardando"}
            </span>
          )}
        </div>
        <span className="text-muted-foreground font-mono text-[10px]">
          {msg.schedule_type}
        </span>
      </div>
    </div>
  );
}

/* ─── main panel ─── */
export default function SchedulerDebugPanel() {
  const { data, isLoading, refresh } = useSchedulerDebug();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const messages = data?.messages || [];

  // Sort by next_run_at ascending
  const sorted = useMemo(
    () => [...messages].sort((a, b) => {
      const aTime = a.next_run_at ? new Date(a.next_run_at).getTime() : 0;
      const bTime = b.next_run_at ? new Date(b.next_run_at).getTime() : 0;
      return aTime - bTime;
    }),
    [messages],
  );

  // Find next future message index (based on current UTC time which aligns with next_run_at stored in UTC)
  const nextIdx = useMemo(() => {
    const nowMs = Date.now();
    const idx = sorted.findIndex(m => m.next_run_at && new Date(m.next_run_at).getTime() > nowMs);
    return idx >= 0 ? idx : sorted.length - 1;
  }, [sorted]);

  // Update scroll indicators
  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  // Scroll to "next" card on load
  useEffect(() => {
    if (!scrollRef.current || sorted.length === 0) return;
    const cardWidth = 326; // 310 + gap
    const containerWidth = scrollRef.current.clientWidth;
    const targetScroll = Math.max(0, nextIdx * cardWidth - containerWidth / 2 + cardWidth / 2);
    scrollRef.current.scrollTo({ left: targetScroll, behavior: "smooth" });
    setTimeout(updateScrollState, 500);
  }, [sorted.length, nextIdx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener("scroll", updateScrollState);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 340;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  // Summary counters
  const totalSent = messages.reduce((sum, m) => sum + m.queue_items.filter(qi => qi.status === "sent").length, 0);
  const totalFailed = messages.reduce((sum, m) => sum + m.queue_items.filter(qi => qi.status === "failed").length, 0);
  const totalMissed = messages.filter(m => m.missed).length;

  return (
    <Card className="border-border/50">
      <CardContent className="p-0">
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
                  <Clock className="h-3 w-3" />{data.server_time_brt} BRT
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
          <div className="relative">
            {/* Left arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scroll("left")}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 border border-border/50 flex items-center justify-center hover:bg-muted/40 transition-colors shadow-md"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Right arrow */}
            {canScrollRight && (
              <button
                onClick={() => scroll("right")}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 border border-border/50 flex items-center justify-center hover:bg-muted/40 transition-colors shadow-md"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto py-4 px-4 scroll-smooth"
              style={{
                scrollSnapType: "x mandatory",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {sorted.map((msg, idx) => (
                <ScheduleCard key={msg.id} msg={msg} isNext={idx === nextIdx} />
              ))}
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
