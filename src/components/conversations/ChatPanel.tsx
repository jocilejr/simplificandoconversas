import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Send, Loader2, Check, CheckCheck,
  Bot, PanelRight, X, Plus, Search, Settings,
} from "lucide-react";
import { Message } from "@/hooks/useMessages";
import { Conversation } from "@/hooks/useConversations";
import { ContactAvatar } from "./ContactAvatar";
import { cn } from "@/lib/utils";
import { WhatsAppAudioPlayer } from "./WhatsAppAudioPlayer";
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

function isLidJid(jid: string) {
  return jid.includes("@lid");
}

function formatJid(jid: string) {
  return jid.split("@")[0];
}

function formatPhone(num: string) {
  if (num.length >= 12) {
    return `+${num.slice(0, 2)} (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
  }
  return `+${num}`;
}

function displaySubtitle(conv: Conversation) {
  if (conv.phone_number) return formatPhone(conv.phone_number);
  if (isLidJid(conv.remote_jid)) return `ID: ${formatJid(conv.remote_jid)}`;
  return formatJid(conv.remote_jid);
}

function StatusIcon({ status }: { status: string }) {
  if (status === "failed" || status === "error") {
    return <X className="h-3 w-3 text-red-500" />;
  }
  if (status === "delivered" || status === "read") {
    return <CheckCheck className={cn("h-3 w-3", status === "read" ? "text-info" : "text-white/40")} />;
  }
  if (status === "sending") {
    return <Loader2 className="h-3 w-3 text-white/40 animate-spin" />;
  }
  return <Check className="h-3 w-3 text-white/40" />;
}

export function ChatPanel({
  conversation, messages, isLoading, onSend, isSending, contactPhoto,
  onToggleRightPanel, showRightPanel,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const [executingFlow, setExecutingFlow] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [qrSearch, setQrSearch] = useState("");
  const [showNewQRForm, setShowNewQRForm] = useState(false);
  const [newQRTitle, setNewQRTitle] = useState("");
  const [newQRContent, setNewQRContent] = useState("");
  const [managingQR, setManagingQR] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qrSearchRef = useRef<HTMLInputElement>(null);
  const { data: flows } = useChatbotFlows();
  const { data: quickReplies, create: createQR, remove: removeQR } = useQuickReplies();
  const { data: activeExecutions, cancel: cancelExecution } = useFlowExecutions(conversation?.id);
  const savedFlows = flows?.filter(f => (f.nodes as any[])?.length > 0) || [];
  const hasActiveFlow = (activeExecutions?.length || 0) > 0;

  const handleExecuteFlow = async (flowId: string) => {
    if (!conversation) return;
    setExecutingFlow(true);
    try {
      const { data, error } = await supabase.functions.invoke("execute-flow", {
        body: { flowId, remoteJid: conversation.remote_jid, conversationId: conversation.id, instanceName: conversation.instance_name },
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
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-20 w-20 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-lg">Suas conversas</p>
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
      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-3 bg-card/80 backdrop-blur-sm">
        <ContactAvatar photoUrl={contactPhoto} name={conversation.contact_name} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-foreground">
            {conversation.contact_name || (conversation.phone_number ? formatPhone(conversation.phone_number) : formatJid(conversation.remote_jid))}
          </p>
          <p className="text-xs text-muted-foreground">
            {displaySubtitle(conversation)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full",
            showRightPanel && "bg-primary/10 text-primary"
          )}
          onClick={onToggleRightPanel}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1 chat-bg-pattern">
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
                  <div className="flex justify-center my-4">
                    <span className="text-[11px] text-foreground/80 bg-card/90 backdrop-blur-sm px-4 py-1.5 rounded-lg font-medium shadow-sm">
                      {format(new Date(msg.created_at), "dd/MM/yyyy")}
                    </span>
                  </div>
                )}
                <div className={cn("flex mb-1", isOutbound ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] text-sm shadow-sm",
                      msg.message_type === "audio" ? "px-2 py-1.5" : "px-4 py-2.5",
                      isOutbound
                        ? "bg-[#075e54] text-white rounded-2xl rounded-br-sm"
                        : "bg-[#1f2c34] text-white rounded-2xl rounded-bl-sm"
                    )}
                  >
                    {msg.media_url && (
                      <div className={cn("mb-2", !msg.content && "-mx-1 -mt-1")}>
                        {msg.message_type === "image" ? (
                          <img
                            src={msg.media_url}
                            alt=""
                            className="rounded-xl max-w-[360px] max-h-[360px] w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            loading="lazy"
                            onClick={() => setLightboxUrl(msg.media_url!)}
                          />
                        ) : msg.message_type === "audio" ? (
                          <WhatsAppAudioPlayer
                            src={msg.media_url}
                            isOutbound={isOutbound}
                            contactPhoto={!isOutbound ? contactPhoto : undefined}
                            contactName={!isOutbound ? conversation.contact_name : undefined}
                            timestamp={format(new Date(msg.created_at), "HH:mm")}
                          />
                        ) : msg.message_type === "video" ? (
                          <video
                            controls
                            src={msg.media_url}
                            className="rounded-xl max-w-[360px] max-h-[360px]"
                            preload="metadata"
                          />
                        ) : msg.message_type === "document" ? (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs"
                          >
                            Documento anexado
                          </a>
                        ) : null}
                      </div>
                    )}
                    {msg.content && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>}
                    {msg.message_type !== "audio" && (
                      <div className={cn(
                        "flex items-center gap-1 justify-end mt-1",
                        isOutbound ? "text-white/50" : "text-muted-foreground/60"
                      )}>
                        <span className="text-[10px]">{format(new Date(msg.created_at), "HH:mm")}</span>
                        {isOutbound && <StatusIcon status={msg.status} />}
                      </div>
                    )}
                    {msg.message_type === "audio" && isOutbound && (
                      <div className="flex items-center gap-1 justify-end -mt-1">
                        <StatusIcon status={msg.status} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Active flow banner */}
      {hasActiveFlow && (
        <div className="px-4 py-2.5 border-t border-border/60 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bot className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {activeExecutions![0].chatbot_flows?.name || "Fluxo"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {activeExecutions![0].status === "waiting_click" ? "Aguardando clique" : activeExecutions![0].status === "waiting_reply" ? "Aguardando resposta" : "Executando"}
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs rounded-full px-3"
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
      <div className="px-4 py-3 border-t border-border/60 bg-card/60 backdrop-blur-sm flex items-center gap-2">
        {/* Bot flows */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full shrink-0",
                hasActiveFlow
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
              disabled={executingFlow || hasActiveFlow}
            >
              {executingFlow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1.5 rounded-xl">
            <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Disparar Fluxo</p>
            {savedFlows.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhum fluxo salvo</p>
            ) : (
              savedFlows.map((flow) => (
                <button
                  key={flow.id}
                  className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg hover:bg-secondary transition-colors text-left text-sm"
                  onClick={() => handleExecuteFlow(flow.id)}
                >
                  <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{flow.name}</span>
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>

        <div className="relative flex-1">
          {showQuickReplies && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              className="absolute bottom-full mb-2 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl z-10 flex overflow-hidden" style={{ maxHeight: 340 }}>
              {/* Left: list */}
              <div className="flex flex-col w-[220px] border-r border-border/40">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
                  <span className="text-sm font-semibold text-foreground">Respostas prontas</span>
                  <div className="flex items-center gap-1">
                    <button
                      className="text-xs text-primary hover:underline font-medium"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setManagingQR(!managingQR);
                      }}
                    >
                      {managingQR ? "Voltar" : "Gerenciar"}
                    </button>
                    <button
                      className="text-xs text-primary hover:underline font-medium"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowNewQRForm(true);
                        setManagingQR(false);
                      }}
                    >
                      + Novo
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="px-2 py-1.5 border-b border-border/40">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      ref={qrSearchRef}
                      type="text"
                      placeholder="Pesquisar"
                      value={qrSearch}
                      onChange={(e) => setQrSearch(e.target.value)}
                      className="w-full h-8 pl-7 pr-2 text-sm bg-secondary/50 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* New QR form */}
                {showNewQRForm && (
                  <div className="p-2.5 border-b border-border/40 space-y-1.5">
                    <input
                      placeholder="Título..."
                      value={newQRTitle}
                      onChange={(e) => setNewQRTitle(e.target.value)}
                      className="w-full h-7 px-2 text-xs bg-secondary/50 border border-border/40 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <textarea
                      placeholder="Conteúdo..."
                      value={newQRContent}
                      onChange={(e) => setNewQRContent(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border/40 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground resize-none"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-1">
                      <button
                        className="flex-1 h-6 text-[10px] bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
                        disabled={!newQRTitle.trim() || !newQRContent.trim()}
                        onMouseDown={async (e) => {
                          e.preventDefault();
                          try {
                            await createQR.mutateAsync({ title: newQRTitle, content: newQRContent });
                            setNewQRTitle("");
                            setNewQRContent("");
                            setShowNewQRForm(false);
                            toast.success("Resposta rápida criada");
                          } catch {
                            toast.error("Erro ao criar");
                          }
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground rounded-md"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowNewQRForm(false);
                          setNewQRTitle("");
                          setNewQRContent("");
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {(quickReplies || [])
                    .filter((qr) => {
                      const s = qrSearch.toLowerCase();
                      return !s || qr.title.toLowerCase().includes(s) || qr.content.toLowerCase().includes(s);
                    })
                    .map((qr) => (
                      <div
                        key={qr.id}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-left text-sm border-b border-border/20",
                          selectedQR === qr.id ? "bg-secondary" : "hover:bg-secondary/50"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (managingQR) return;
                          setSelectedQR(qr.id);
                        }}
                        onDoubleClick={() => {
                          if (managingQR) return;
                          setText(qr.content);
                          setShowQuickReplies(false);
                          setSelectedQR(null);
                          setQrSearch("");
                        }}
                      >
                        <span className="truncate text-foreground">{qr.title}</span>
                        {managingQR && (
                          <button
                            className="ml-2 text-destructive hover:text-destructive/80 shrink-0"
                            onMouseDown={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeQR.mutate(qr.id);
                              if (selectedQR === qr.id) setSelectedQR(null);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  {(!quickReplies || quickReplies.length === 0) && !showNewQRForm && (
                    <div className="px-3 py-6 text-center">
                      <p className="text-xs text-muted-foreground mb-2">Nenhuma resposta salva</p>
                      <button
                        className="text-xs text-primary hover:underline font-medium"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowNewQRForm(true);
                        }}
                      >
                        + Criar primeira resposta
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: preview */}
              <div className="flex-1 p-3 flex flex-col min-w-0">
                {(() => {
                  const selected = quickReplies?.find(qr => qr.id === selectedQR);
                  if (!selected) {
                    return (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                        Selecione uma resposta para ver o conteúdo
                      </div>
                    );
                  }
                  return (
                    <>
                      <p className="text-sm font-medium text-foreground mb-2">{selected.title}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap flex-1 overflow-y-auto">{selected.content}</p>
                      <Button
                        size="sm"
                        className="mt-2 rounded-lg self-end"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setText(selected.content);
                          setShowQuickReplies(false);
                          setSelectedQR(null);
                          setQrSearch("");
                        }}
                      >
                        Usar resposta
                      </Button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          <Input
            placeholder="Digite uma mensagem... (/ para respostas rápidas)"
            value={text}
            onChange={(e) => {
              const val = e.target.value;
              setText(val);
              if (val.startsWith("/") && !showQuickReplies) {
                setShowQuickReplies(true);
                setQrSearch("");
                setSelectedQR(null);
                setShowNewQRForm(false);
                setManagingQR(false);
              } else if (val.startsWith("/")) {
                setQrSearch(val.slice(1));
              } else {
                setShowQuickReplies(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowQuickReplies(false);
                setSelectedQR(null);
                setQrSearch("");
              }
              if (e.key === "Enter" && !e.shiftKey && !showQuickReplies) handleSend();
            }}
            onBlur={() => setTimeout(() => {
              setShowQuickReplies(false);
              setSelectedQR(null);
              setQrSearch("");
            }, 200)}
            className="h-10 bg-secondary/50 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-full px-4 text-sm"
          />
        </div>
        <Button
          size="icon"
          className="h-9 w-9 rounded-full shrink-0 shadow-sm"
          onClick={handleSend}
          disabled={!text.trim() || isSending}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
