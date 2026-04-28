import { useEffect, useRef } from "react";
import { ChatMessage } from "@/hooks/useMessagesLive";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, FileText, Mic, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  contactName: string;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "read") return <CheckCheck className="h-3 w-3 text-primary" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  if (status === "failed") return <span className="text-[9px] text-destructive">!</span>;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

function MessageBody({ m }: { m: ChatMessage }) {
  const type = m.message_type;
  if ((type === "image" || type === "imageMessage") && m.media_url) {
    return (
      <div className="space-y-1">
        <img
          src={m.media_url}
          alt="imagem"
          className="max-w-[240px] rounded-md border border-border object-cover"
          loading="lazy"
        />
        {m.content && <p className="text-xs whitespace-pre-wrap break-words">{m.content}</p>}
      </div>
    );
  }
  if ((type === "audio" || type === "audioMessage" || type === "ptt") && m.media_url) {
    return (
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4" />
        <audio controls src={m.media_url} className="max-w-[240px]" />
      </div>
    );
  }
  if ((type === "video" || type === "videoMessage") && m.media_url) {
    return (
      <video controls src={m.media_url} className="max-w-[260px] rounded-md border border-border" />
    );
  }
  if ((type === "document" || type === "documentMessage") && m.media_url) {
    return (
      <a
        href={m.media_url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background/50 text-xs hover:bg-background/80"
      >
        <FileText className="h-4 w-4" />
        <span className="truncate max-w-[200px]">{m.content || "Documento"}</span>
      </a>
    );
  }
  if (m.media_url && !m.content) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <ImageIcon className="h-4 w-4" />
        <a href={m.media_url} target="_blank" rel="noreferrer" className="underline">
          mídia
        </a>
      </div>
    );
  }
  return <p className="text-xs whitespace-pre-wrap break-words">{m.content || ""}</p>;
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
              return (
                <div
                  key={m.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                      mine
                        ? "bg-primary/90 text-primary-foreground"
                        : "bg-card border border-border"
                    )}
                  >
                    <MessageBody m={m} />
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[9px] opacity-70">
                        {format(new Date(m.created_at), "HH:mm")}
                      </span>
                      {mine && <StatusIcon status={m.status} />}
                    </div>
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
