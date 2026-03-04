import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Send, Loader2, Check, CheckCheck,
  Bot, PanelRight, Zap,
} from "lucide-react";
import { Message } from "@/hooks/useMessages";
import { Conversation } from "@/hooks/useConversations";
import { ContactAvatar } from "./ContactAvatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { useFlowExecutions } from "@/hooks/useFlowExecutions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[] | undefined;
  isLoading: boolean;
  onSend: (text: string) => Promise<void>;
  isSending: boolean;
  contactPhoto?: string | null;
  onToggleRightPanel: () => void;
  showRightPanel: boolean;
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

export function ChatPanel({
  conversation, messages, isLoading, onSend, isSending, contactPhoto,
  onToggleRightPanel, showRightPanel,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const [executingFlow, setExecutingFlow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: flows } = useChatbotFlows();
  const { data: quickReplies } = useQuickReplies();
  const { data: activeExecutions, cancel: cancelExecution } = useFlowExecutions(conversation?.id);
  const savedFlows = flows?.filter(f => (f.nodes as any[])?.length > 0) || [];
  const hasActiveFlow = (activeExecutions?.length || 0) > 0;

  const handleExecuteFlow = async (flowId: string) => {
    if (!conversation) return;
    setExecutingFlow(true);
    try {
      const { data, error } = await supabase.functions.invoke("execute-flow", {
        body: { flowId, remoteJid: conversation.remote_jid },
      });
      if (error) throw error;
      toast.success(`Fluxo executado: ${data?.executed?.length || 0} ações`);
    } catch (err: any) {
      toast.error("Erro ao executar fluxo: " + (err.message || "Erro desconhecido"));
    } finally {
      setExecutingFlow(false);
    }
  };

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
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
        <ContactAvatar photoUrl={contactPhoto} name={conversation.contact_name} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {conversation.contact_name || formatJid(conversation.remote_jid)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatJid(conversation.remote_jid)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", showRightPanel && "bg-accent")}
          onClick={onToggleRightPanel}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !messages?.length ? (
          <p className="text-center text-sm text-muted-foreground py-12">Nenhuma mensagem ainda</p>
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
                <div className={cn("flex mb-0.5", isOutbound ? "justify-end" : "justify-start")}>
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
                    <div className={cn(
                      "flex items-center gap-1 justify-end mt-1",
                      isOutbound ? "text-primary-foreground/60" : "text-muted-foreground"
                    )}>
                      <span className="text-[10px]">{format(new Date(msg.created_at), "HH:mm")}</span>
                      {isOutbound && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Active flow banner */}
      {hasActiveFlow && (
        <div className="px-4 py-2 border-t border-border bg-accent flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">
              Fluxo ativo: {activeExecutions![0].chatbot_flows?.name || "Fluxo"}
            </span>
            <span className="text-[10px]">
              ({activeExecutions![0].status === "waiting_click" ? "Aguardando clique" : "Executando"})
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 text-[10px]"
            onClick={() => {
              cancelExecution.mutate(activeExecutions![0].id);
              toast.success("Fluxo cancelado");
            }}
          >
            Parar
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border bg-card flex items-center gap-2">
        {/* Bot flows */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-full shrink-0",
                hasActiveFlow
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary/10 hover:bg-primary/20 text-primary"
              )}
              disabled={executingFlow || hasActiveFlow}
            >
              {executingFlow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
            <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Disparar Fluxo</p>
            {savedFlows.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhum fluxo salvo</p>
            ) : (
              savedFlows.map((flow) => (
                <button
                  key={flow.id}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-secondary transition-colors text-left text-sm"
                  onClick={() => handleExecuteFlow(flow.id)}
                >
                  <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{flow.name}</span>
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>

        {/* Quick replies */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <Zap className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1">
            <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Respostas Rápidas</p>
            {(!quickReplies || quickReplies.length === 0) ? (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhuma resposta salva</p>
            ) : (
              quickReplies.map((qr) => (
                <button
                  key={qr.id}
                  className="flex flex-col w-full px-2 py-2 rounded-md hover:bg-secondary transition-colors text-left"
                  onClick={() => setText(qr.content)}
                >
                  <span className="text-sm font-medium truncate">{qr.title}</span>
                  <span className="text-xs text-muted-foreground truncate">{qr.content}</span>
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>

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
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
