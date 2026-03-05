import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ContactAvatar } from "./ContactAvatar";
import { Conversation } from "@/hooks/useConversations";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { useLabels, useConversationLabels } from "@/hooks/useLabels";
import { useFlowExecutions } from "@/hooks/useFlowExecutions";
import {
  X, Plus, Trash2, Pencil, Check, Tag, Zap, Square, Loader2, Clock, Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RightPanelProps {
  conversation: Conversation;
  contactPhoto?: string | null;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

function formatJid(jid: string) {
  return jid.split("@")[0];
}

export function RightPanel({ conversation, contactPhoto, onClose }: RightPanelProps) {
  const { data: quickReplies, create: createQR, remove: removeQR, update: updateQR } = useQuickReplies();
  const [qrTitle, setQrTitle] = useState("");
  const [qrContent, setQrContent] = useState("");
  const [editingQR, setEditingQR] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const { data: allLabels, create: createLabel, remove: removeLabel } = useLabels();
  const { data: convLabels, assign, unassign } = useConversationLabels(conversation.id);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState(PRESET_COLORS[0]);

  const { data: activeExecutions, cancel: cancelExecution } = useFlowExecutions(conversation.id);

  const assignedLabelIds = new Set((convLabels || []).map(cl => cl.label_id));

  const handleCreateQR = async () => {
    if (!qrTitle.trim() || !qrContent.trim()) return;
    try {
      await createQR.mutateAsync({ title: qrTitle, content: qrContent });
      setQrTitle("");
      setQrContent("");
    } catch { toast.error("Erro ao criar resposta rápida"); }
  };

  const handleCreateLabel = async () => {
    if (!labelName.trim()) return;
    try {
      await createLabel.mutateAsync({ name: labelName, color: labelColor });
      setLabelName("");
    } catch { toast.error("Erro ao criar etiqueta"); }
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
    <div className="w-80 border-l border-[#2a3942] bg-[#111b21] flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2a3942] flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Detalhes</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Contact Info Card */}
          <div className="bg-[#202c33] rounded-xl p-5 flex flex-col items-center text-center gap-3">
            <ContactAvatar photoUrl={contactPhoto} name={conversation.contact_name} size="xl" />
            <div>
              <p className="font-semibold text-base text-foreground">
                {conversation.contact_name || formatJid(conversation.remote_jid)}
              </p>
              <div className="flex items-center gap-1.5 justify-center mt-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{formatJid(conversation.remote_jid)}</p>
              </div>
            </div>
          </div>

          {/* Active Flow Executions */}
          <div className="bg-[#202c33] rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Fluxo Ativo</span>
            </div>

            {activeExecutions && activeExecutions.length > 0 ? (
              <div className="space-y-2">
                {activeExecutions.map((exec: any) => {
                  const isWaiting = exec.status === "waiting_click";
                  return (
                    <div key={exec.id} className={cn(
                      "flex items-center justify-between rounded-lg p-3 border",
                      isWaiting ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"
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
                            {isWaiting ? "Aguardando clique" : "Executando"}
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

          {/* Labels Section */}
          <div className="bg-[#202c33] rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Etiquetas</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {(convLabels || []).map(cl => (
                <Badge
                  key={cl.id}
                  className="text-[11px] gap-1 cursor-pointer hover:opacity-80 border-0 rounded-full px-2.5"
                  style={{ backgroundColor: cl.labels.color, color: "#fff" }}
                  onClick={() => unassign.mutate(cl.label_id)}
                >
                  {cl.labels.name}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
              {(!convLabels || convLabels.length === 0) && (
                <span className="text-xs text-muted-foreground">Nenhuma etiqueta</span>
              )}
            </div>

            <div className="space-y-1 mb-3">
              {(allLabels || []).filter(l => !assignedLabelIds.has(l.id)).map(label => (
                <div key={label.id} className="flex items-center justify-between group">
                  <button
                    className="flex items-center gap-2 text-xs py-1.5 hover:text-foreground text-muted-foreground transition-colors"
                    onClick={() => assign.mutate(label.id)}
                  >
                    <span className="h-3 w-3 rounded-full shrink-0 ring-1 ring-border/30" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 rounded-full"
                    onClick={() => removeLabel.mutate(label.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Nova etiqueta..."
                  value={labelName}
                  onChange={e => setLabelName(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                  onKeyDown={e => e.key === "Enter" && handleCreateLabel()}
                />
                <Button size="icon" className="h-8 w-8 shrink-0 rounded-lg" onClick={handleCreateLabel} disabled={!labelName.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={cn(
                      "h-5 w-5 rounded-full transition-all",
                      labelColor === c ? "ring-2 ring-offset-1 ring-ring scale-110" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setLabelColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Quick Replies Section */}
          <div className="bg-[#202c33] rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Respostas Rápidas</span>
            </div>

            <div className="space-y-2 mb-3">
              {(quickReplies || []).map(qr => (
                <div key={qr.id} className="bg-background/60 rounded-lg p-3 group border border-border/30">
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

            <div className="space-y-1.5 pt-2 border-t border-border/30">
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
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
