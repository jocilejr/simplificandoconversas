import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ContactAvatar } from "./ContactAvatar";
import { Conversation } from "@/hooks/useConversations";

import { useFlowExecutions } from "@/hooks/useFlowExecutions";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  X, Tag, Zap, Square, Loader2, Clock, Phone,
  Globe, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface RightPanelProps {
  conversation: Conversation;
  contactPhoto?: string | null;
  onClose: () => void;
}


function formatJid(jid: string) {
  return jid.split("@")[0];
}

function formatPhone(jid: string) {
  const num = jid.split("@")[0];
  if (num.length >= 12) {
    return `+${num.slice(0, 2)} (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
  }
  return `+${num}`;
}

export function RightPanel({ conversation, contactPhoto, onClose }: RightPanelProps) {

  const { data: activeExecutions, cancel: cancelExecution } = useFlowExecutions(conversation.id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const contactNumber = conversation.remote_jid;

  // Fetch contact tags
  const { data: contactTags } = useQuery({
    queryKey: ["contact-tags", contactNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_tags")
        .select("id, tag_name, created_at")
        .eq("remote_jid", contactNumber)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!contactNumber,
  });

  const handleRemoveTag = async (tagId: string) => {
    const { error } = await supabase.from("contact_tags").delete().eq("id", tagId);
    if (error) {
      toast.error("Erro ao remover tag");
    } else {
      toast.success("Tag removida");
      queryClient.invalidateQueries({ queryKey: ["contact-tags", contactNumber] });
    }
  };
  // Fetch last messages from ALL instances for this contact
  const { data: allInstanceMessages } = useQuery({
    queryKey: ["all-instance-messages", contactNumber, conversation.id],
    queryFn: async () => {
      const { data: allConvs } = await supabase
        .from("conversations")
        .select("id, instance_name")
        .eq("remote_jid", contactNumber);
      if (!allConvs || allConvs.length === 0) return [];

      const results = await Promise.all(
        allConvs.map(async (conv) => {
          const { data: msgs } = await supabase
            .from("messages")
            .select("id, content, direction, message_type, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(5);
          return {
            instance_name: conv.instance_name,
            conversation_id: conv.id,
            is_current: conv.id === conversation.id,
            messages: msgs || [],
          };
        })
      );
      return results.filter(r => r.messages.length > 0 && !r.is_current);
    },
    enabled: !!contactNumber && !!conversation.id,
  });


  const handleCreateQR = async () => {
    if (!qrTitle.trim() || !qrContent.trim()) return;
    try {
      await createQR.mutateAsync({ title: qrTitle, content: qrContent });
      setQrTitle("");
      setQrContent("");
      setShowQRForm(false);
    } catch { toast.error("Erro ao criar resposta rápida"); }
  };

  const startEditQR = (qr: { id: string; title: string; content: string }) => {
    setEditingQR(qr.id);
    setEditTitle(qr.title);
    setEditContent(qr.content);
  };

  const saveEditQR = async () => {
    if (!editingQR || !editTitle.trim() || !editContent.trim()) return;
    try {
      await updateQR.mutateAsync({ id: editingQR, title: editTitle, content: editContent });
      setEditingQR(null);
    } catch { toast.error("Erro ao atualizar"); }
  };

  return (
    <div className="w-[340px] border-l border-border/60 bg-background flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between bg-card/80 backdrop-blur-sm">
        <span className="text-sm font-semibold text-foreground">Detalhes do Lead</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">

          {/* ── Contact Card ── */}
          <div className="bg-secondary/40 rounded-2xl p-5 flex flex-col items-center text-center">
            <ContactAvatar photoUrl={contactPhoto} name={conversation.contact_name} size="xl" />
            <h2 className="mt-3 font-bold text-base text-foreground">
              {conversation.contact_name || formatJid(conversation.remote_jid)}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="text-xs">{formatPhone(conversation.remote_jid)}</span>
            </div>
            {conversation.instance_name && (
              <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
                <Globe className="h-3 w-3" />
                <span className="text-xs">{conversation.instance_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">
                Desde {format(new Date(conversation.created_at), "dd/MM/yyyy")}
              </span>
            </div>
          </div>

          {/* ── History from All Instances ── */}
          {allInstanceMessages && allInstanceMessages.length > 0 && (
            <div className="bg-secondary/40 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                  Histórico de Mensagens
                </span>
              </div>
              <div className="space-y-3">
                {allInstanceMessages.map((inst, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Globe className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">
                        {inst.instance_name || "Sem nome"}
                        {inst.is_current && " (atual)"}
                      </span>
                    </div>
                    <div className="space-y-1 pl-6">
                      {inst.messages.map((msg) => (
                        <div key={msg.id} className="bg-background rounded-lg p-2 border border-border/20">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={cn(
                              "text-[10px] font-medium",
                              msg.direction === "inbound" ? "text-primary" : "text-muted-foreground"
                            )}>
                              {msg.direction === "inbound" ? "Recebida" : "Enviada"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(msg.created_at), "dd/MM HH:mm")}
                            </span>
                          </div>
                          <p className="text-[11px] text-foreground line-clamp-2">
                            {msg.message_type !== "text" ? `[${msg.message_type}]` : msg.content || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Active Flow ── */}
          <div className="bg-secondary/40 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Fluxo Ativo</span>
            </div>

            {activeExecutions && activeExecutions.length > 0 ? (
              <div className="space-y-2">
                {activeExecutions.map((exec: any) => {
                  const isWaiting = exec.status === "waiting_click" || exec.status === "waiting_reply";
                  return (
                    <div key={exec.id} className={cn(
                      "flex items-center justify-between rounded-xl p-3",
                      isWaiting ? "bg-primary/10 border border-primary/20" : "bg-destructive/10 border border-destructive/20"
                    )}>
                      <div className="flex items-center gap-2 min-w-0">
                        {isWaiting ? (
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 text-destructive animate-spin shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-medium truncate block text-foreground">
                            {exec.chatbot_flows?.name || "Fluxo"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {exec.status === "waiting_click" ? "Aguardando clique" : exec.status === "waiting_reply" ? "Aguardando resposta" : "Executando"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-[10px] shrink-0 ml-2 rounded-full px-2.5"
                        onClick={() => {
                          cancelExecution.mutate(exec.id);
                          toast.success("Fluxo cancelado");
                        }}
                      >
                        <Square className="h-2.5 w-2.5 mr-1" />
                        Parar
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum fluxo em execução</p>
            )}
          </div>

          {/* ── Contact Tags (from flows) ── */}
          <div className="bg-secondary/40 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Tag className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Tags do Contato</span>
            </div>
            {contactTags && contactTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {contactTags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="text-[11px] gap-1.5 cursor-pointer hover:opacity-80 rounded-full px-3 py-1 font-medium bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30"
                    onClick={() => handleRemoveTag(tag.id)}
                  >
                    {tag.tag_name}
                    <X className="h-2.5 w-2.5 opacity-60" />
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma tag atribuída</p>
            )}
          </div>


          {/* ── Quick Replies ── */}
          <div className="bg-secondary/40 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-warning" />
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Respostas Rápidas</span>
              </div>
              <button
                onClick={() => setShowQRForm(!showQRForm)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showQRForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>

            <div className="space-y-2 mb-3">
              {(quickReplies || []).map(qr => (
                <div key={qr.id} className="bg-background rounded-xl p-3 group border border-border/30">
                  {editingQR === qr.id ? (
                    <div className="space-y-1.5">
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-7 text-xs rounded-lg" />
                      <Input value={editContent} onChange={e => setEditContent(e.target.value)} className="h-7 text-xs rounded-lg" />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-[10px] rounded-full" onClick={saveEditQR}>
                          <Check className="h-3 w-3 mr-1" /> Salvar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] rounded-full" onClick={() => setEditingQR(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <p className="text-xs font-medium text-foreground">{qr.title}</p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={() => startEditQR(qr)}>
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={() => removeQR.mutate(qr.id)}>
                            <Trash2 className="h-2.5 w-2.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{qr.content}</p>
                    </>
                  )}
                </div>
              ))}
              {(!quickReplies || quickReplies.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhuma resposta salva</p>
              )}
            </div>

            {showQRForm && (
              <div className="space-y-1.5 border-t border-border/30 pt-3">
                <Input
                  placeholder="Título..."
                  value={qrTitle}
                  onChange={e => setQrTitle(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
                <Input
                  placeholder="Conteúdo da resposta..."
                  value={qrContent}
                  onChange={e => setQrContent(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                  onKeyDown={e => e.key === "Enter" && handleCreateQR()}
                />
                <Button
                  size="sm"
                  className="w-full h-8 text-xs rounded-lg"
                  onClick={handleCreateQR}
                  disabled={!qrTitle.trim() || !qrContent.trim()}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
            )}
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
