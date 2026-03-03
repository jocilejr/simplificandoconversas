import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Loader2, User, RefreshCw } from "lucide-react";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const Conversations = () => {
  const queryClient = useQueryClient();
  const { data: conversations, isLoading: loadingConvs, markAsRead } = useConversations();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const { data: messages, isLoading: loadingMsgs, sendMessage } = useMessages(selected?.id || null, selected?.remote_jid || null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const syncChats = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "sync-chats" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Sincronizado", description: `${data?.synced || 0} conversas sincronizadas` });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    },
  });

  const filtered = conversations?.filter(
    (c) =>
      (c.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
      c.remote_jid.includes(search)
  );

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark as read on select
  useEffect(() => {
    if (selected && selected.unread_count > 0) {
      markAsRead(selected.id);
    }
  }, [selected]);

  const handleSend = async () => {
    if (!text.trim() || !selected) return;
    const msg = text;
    setText("");
    try {
      await sendMessage.mutateAsync({
        remoteJid: selected.remote_jid,
        message: msg,
      });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    }
  };

  const formatJid = (jid: string) => jid.split("@")[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Conversas</h1>
        <p className="text-muted-foreground">Visualize e gerencie conversas em tempo real</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[calc(100vh-12rem)]">
        {/* Left panel - conversation list */}
        <Card className="bg-card border-border rounded-r-none lg:border-r-0 flex flex-col">
          <div className="p-3 border-b border-border flex gap-2">
            <Input
              placeholder="Buscar conversas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => syncChats.mutate()}
              disabled={syncChats.isPending}
              title="Sincronizar conversas do WhatsApp"
            >
              {syncChats.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {loadingConvs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !filtered?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2" />
                <span className="text-sm">Nenhuma conversa</span>
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={cn(
                    "w-full text-left p-3 border-b border-border hover:bg-accent/50 transition-colors",
                    selected?.id === conv.id && "bg-accent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {conv.contact_name || formatJid(conv.remote_jid)}
                        </span>
                        {conv.unread_count > 0 && (
                          <Badge variant="default" className="ml-2 h-5 min-w-5 text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.last_message || "Sem mensagens"}
                      </p>
                      {conv.last_message_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(conv.last_message_at), "dd/MM HH:mm")}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </Card>

        {/* Right panel - chat */}
        <Card className="lg:col-span-2 bg-card border-border rounded-l-none flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3" />
                <p className="text-sm">Selecione uma conversa para visualizar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-3 border-b border-border flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {selected.contact_name || formatJid(selected.remote_jid)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatJid(selected.remote_jid)}</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !messages?.length ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma mensagem ainda
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.direction === "outbound" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg px-3 py-2 text-sm",
                          msg.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {msg.media_url && (
                          <div className="mb-1">
                            {msg.message_type === "image" ? (
                              <img src={msg.media_url} alt="" className="rounded max-w-full" />
                            ) : msg.message_type === "audio" ? (
                              <audio controls src={msg.media_url} className="max-w-full" />
                            ) : msg.message_type === "video" ? (
                              <video controls src={msg.media_url} className="rounded max-w-full" />
                            ) : null}
                          </div>
                        )}
                        {msg.content && <p>{msg.content}</p>}
                        <p
                          className={cn(
                            "text-[10px] mt-1",
                            msg.direction === "outbound"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  placeholder="Digite uma mensagem..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  className="h-10"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!text.trim() || sendMessage.isPending}
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Conversations;
