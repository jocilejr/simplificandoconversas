import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Loader2, Check, CheckCheck } from "lucide-react";
import { Message } from "@/hooks/useMessages";
import { Conversation } from "@/hooks/useConversations";
import { ContactAvatar } from "./ContactAvatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[] | undefined;
  isLoading: boolean;
  onSend: (text: string) => Promise<void>;
  isSending: boolean;
  contactPhoto?: string | null;
}

function formatJid(jid: string) {
  return jid.split("@")[0];
}

function StatusIcon({ status }: { status: string }) {
  if (status === "delivered" || status === "read") {
    return <CheckCheck className={cn("h-3 w-3", status === "read" ? "text-info" : "text-primary-foreground/50")} />;
  }
  return <Check className="h-3 w-3 text-primary-foreground/50" />;
}

export function ChatPanel({ conversation, messages, isLoading, onSend, isSending, contactPhoto }: ChatPanelProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = text;
    setText("");
    await onSend(msg);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <MessageSquare className="h-7 w-7 text-muted-foreground/60" />
          </div>
          <div>
            <p className="font-medium text-foreground">Suas conversas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione uma conversa para começar
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
        <ContactAvatar
          photoUrl={contactPhoto}
          name={conversation.contact_name}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {conversation.contact_name || formatJid(conversation.remote_jid)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatJid(conversation.remote_jid)}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !messages?.length ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            Nenhuma mensagem ainda
          </p>
        ) : (
          messages.map((msg, idx) => {
            const isOutbound = msg.direction === "outbound";
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showTimeSeparator =
              !prevMsg ||
              format(new Date(msg.created_at), "dd/MM/yyyy") !==
                format(new Date(prevMsg.created_at), "dd/MM/yyyy");

            return (
              <div key={msg.id}>
                {showTimeSeparator && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {format(new Date(msg.created_at), "dd/MM/yyyy")}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex mb-0.5",
                    isOutbound ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      isOutbound
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card text-card-foreground border border-border rounded-bl-md"
                    )}
                  >
                    {msg.media_url && (
                      <div className="mb-1.5">
                        {msg.message_type === "image" ? (
                          <img src={msg.media_url} alt="" className="rounded-lg max-w-full" />
                        ) : msg.message_type === "audio" ? (
                          <audio controls src={msg.media_url} className="max-w-full" />
                        ) : msg.message_type === "video" ? (
                          <video controls src={msg.media_url} className="rounded-lg max-w-full" />
                        ) : null}
                      </div>
                    )}
                    {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                    <div
                      className={cn(
                        "flex items-center gap-1 justify-end mt-1",
                        isOutbound ? "text-primary-foreground/60" : "text-muted-foreground"
                      )}
                    >
                      <span className="text-[10px]">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                      {isOutbound && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card flex items-center gap-2">
        <Input
          placeholder="Digite uma mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          className="h-10 bg-muted/50 border-0 focus-visible:ring-1 rounded-full px-4"
        />
        <Button
          size="icon"
          className="h-10 w-10 rounded-full shrink-0"
          onClick={handleSend}
          disabled={!text.trim() || isSending}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
