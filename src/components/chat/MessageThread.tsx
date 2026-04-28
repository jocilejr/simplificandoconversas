import { useEffect, useRef } from "react";
import { ChatMessage } from "@/hooks/useMessagesLive";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, FileText, Mic, Image as ImageIcon, Video, Sticker, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  contactName: string;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-300" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 opacity-70" />;
  if (status === "failed") return <span className="text-[9px] text-destructive">!</span>;
  return <Check className="h-3 w-3 opacity-70" />;
}

function normalizeType(t: string | null | undefined): string {
  const s = (t || "text").toLowerCase();
  if (s.includes("sticker")) return "sticker";
  if (s.includes("image")) return "image";
  if (s.includes("video")) return "video";
  if (s.includes("audio") || s === "ptt") return "audio";
  if (s.includes("document")) return "document";
  return "text";
}

function MessageBody({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const type = normalizeType(m.message_type);
  const url = m.media_url || undefined;

  if (type === "sticker" && url) {
    return (
      <div className="flex flex-col">
        <img
          src={url}
          alt="figurinha"
          className="w-[140px] h-[140px] object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  if (type === "image" && url) {
    return (
      <div className="space-y-1">
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt="imagem"
            className="max-w-[260px] max-h-[320px] rounded-md object-cover"
            loading="lazy"
          />
        </a>
        {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
      </div>
    );
  }

  if (type === "audio" && url) {
    return (
      <div className="flex items-center gap-2 min-w-[240px]">
        <Mic className={cn("h-4 w-4 shrink-0", mine ? "opacity-80" : "text-primary")} />
        <audio controls src={url} className="h-9 flex-1 max-w-[260px]" />
      </div>
    );
  }

  if (type === "video" && url) {
    return (
      <div className="space-y-1">
        <video
          controls
          src={url}
          className="max-w-[280px] max-h-[320px] rounded-md bg-black"
        />
        {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
      </div>
    );
  }

  if (type === "document" && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        download
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 rounded-md text-xs min-w-[200px] max-w-[280px]",
          mine ? "bg-black/20 hover:bg-black/30" : "bg-background/60 hover:bg-background/80 border border-border"
        )}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">{m.content || "Documento"}</span>
        <Download className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </a>
    );
  }

  // Mídia sem URL (ainda processando)
  if (!m.content && (type === "image" || type === "video" || type === "audio" || type === "document" || type === "sticker")) {
    const Icon = type === "video" ? Video : type === "audio" ? Mic : type === "sticker" ? Sticker : ImageIcon;
    return (
      <div className="flex items-center gap-2 text-xs italic opacity-70">
        <Icon className="h-3.5 w-3.5" />
        <span>[{type}]</span>
      </div>
    );
  }

  return <p className="text-sm whitespace-pre-wrap break-words">{m.content || ""}</p>;
}

export function MessageThread({ messages, loading, contactName }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-14 w-2/5 ml-auto" />
        <Skeleton className="h-12 w-1/2" />
      </div>
    );
  }

  // Group by day
  const groups: Array<{ day: string; items: ChatMessage[] }> = [];
  for (const m of messages) {
    const day = format(new Date(m.created_at), "dd 'de' MMMM yyyy", { locale: ptBR });
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="p-4 space-y-4">
        {groups.map((g) => (
          <div key={g.day} className="space-y-2">
            <div className="flex justify-center">
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {g.day}
              </span>
            </div>
            {g.items.map((m) => {
              const mine = m.direction === "outbound";
              const isSticker = normalizeType(m.message_type) === "sticker" && !!m.media_url;
              return (
                <div
                  key={m.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg shadow-sm",
                      isSticker
                        ? "bg-transparent p-0 shadow-none"
                        : mine
                        ? "bg-primary/90 text-primary-foreground px-3 py-2"
                        : "bg-card border border-border px-3 py-2"
                    )}
                  >
                    <MessageBody m={m} mine={mine} />
                    {!isSticker && (
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[9px] opacity-70">
                          {format(new Date(m.created_at), "HH:mm")}
                        </span>
                        {mine && <StatusIcon status={m.status} />}
                      </div>
                    )}
                    {isSticker && (
                      <div className={cn(
                        "flex items-center gap-1 mt-0.5",
                        mine ? "justify-end" : "justify-start"
                      )}>
                        <span className="text-[9px] text-muted-foreground">
                          {format(new Date(m.created_at), "HH:mm")}
                        </span>
                        {mine && <StatusIcon status={m.status} />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-12">
            Nenhuma mensagem com {contactName} ainda.
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
