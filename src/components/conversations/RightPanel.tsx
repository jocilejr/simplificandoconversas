import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ContactAvatar } from "./ContactAvatar";
import { Conversation } from "@/hooks/useConversations";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { useLabels, useConversationLabels } from "@/hooks/useLabels";
import { useFlowExecutions } from "@/hooks/useFlowExecutions";
import {
  X, Plus, Trash2, Pencil, Check, Tag, Zap, User, Square, Loader2, Clock,
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
  // Quick Replies
  const { data: quickReplies, create: createQR, remove: removeQR, update: updateQR } = useQuickReplies();
  const [qrTitle, setQrTitle] = useState("");
  const [qrContent, setQrContent] = useState("");
  const [editingQR, setEditingQR] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Labels
  const { data: allLabels, create: createLabel, remove: removeLabel } = useLabels();
  const { data: convLabels, assign, unassign } = useConversationLabels(conversation.id);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState(PRESET_COLORS[0]);

  // Flow Executions
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
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Detalhes</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center gap-2">
            <ContactAvatar photoUrl={contactPhoto} name={conversation.contact_name} size="lg" />
            <div>
              <p className="font-semibold text-sm">{conversation.contact_name || formatJid(conversation.remote_jid)}</p>
              <p className="text-xs text-muted-foreground">{formatJid(conversation.remote_jid)}</p>
            </div>
          </div>

          <Separator />

          {/* Active Flow Executions */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fluxo Ativo</span>
            </div>

            {activeExecutions && activeExecutions.length > 0 ? (
              <div className="space-y-2">
                {activeExecutions.map((exec: any) => (
                  <div key={exec.id} className="flex items-center justify-between bg-destructive/10 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader2 className="h-3.5 w-3.5 text-destructive animate-spin shrink-0" />
                      <span className="text-xs font-medium truncate">
                        {exec.chatbot_flows?.name || "Fluxo"}
                      </span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 text-[10px] shrink-0 ml-2"
                      onClick={() => {
                        cancelExecution.mutate(exec.id);
                        toast.success("Fluxo cancelado");
                      }}
                    >
                      <Square className="h-2.5 w-2.5 mr-1" />
                      Parar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum fluxo em execução</p>
            )}
          </div>

          <Separator />

          {/* Labels Section */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Etiquetas</span>
            </div>

            {/* Assigned labels */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(convLabels || []).map(cl => (
                <Badge
                  key={cl.id}
                  className="text-[11px] gap-1 cursor-pointer hover:opacity-80 border-0"
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

            {/* Available labels to assign */}
            <div className="space-y-1 mb-3">
              {(allLabels || []).filter(l => !assignedLabelIds.has(l.id)).map(label => (
                <div key={label.id} className="flex items-center justify-between group">
                  <button
                    className="flex items-center gap-2 text-xs py-1 hover:text-foreground text-muted-foreground transition-colors"
                    onClick={() => assign.mutate(label.id)}
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                    onClick={() => removeLabel.mutate(label.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Create label */}
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Nova etiqueta..."
                  value={labelName}
                  onChange={e => setLabelName(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={e => e.key === "Enter" && handleCreateLabel()}
                />
                <Button size="icon" className="h-7 w-7 shrink-0" onClick={handleCreateLabel} disabled={!labelName.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-1">
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

          <Separator />

          {/* Quick Replies Section */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Respostas Rápidas</span>
            </div>

            <div className="space-y-2 mb-3">
              {(quickReplies || []).map(qr => (
                <div key={qr.id} className="bg-muted/50 rounded-lg p-2.5 group">
                  {editingQR === qr.id ? (
                    <div className="space-y-1.5">
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-7 text-xs" />
                      <Input value={editContent} onChange={e => setEditContent(e.target.value)} className="h-7 text-xs" />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-[10px]" onClick={saveEditQR}>
                          <Check className="h-3 w-3 mr-1" /> Salvar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingQR(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <p className="text-xs font-medium">{qr.title}</p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEditQR(qr)}>
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeQR.mutate(qr.id)}>
                            <Trash2 className="h-2.5 w-2.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{qr.content}</p>
                    </>
                  )}
                </div>
              ))}
              {(!quickReplies || quickReplies.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhuma resposta salva</p>
              )}
            </div>

            {/* Create quick reply */}
            <div className="space-y-1.5">
              <Input
                placeholder="Título..."
                value={qrTitle}
                onChange={e => setQrTitle(e.target.value)}
                className="h-7 text-xs"
              />
              <Input
                placeholder="Conteúdo da resposta..."
                value={qrContent}
                onChange={e => setQrContent(e.target.value)}
                className="h-7 text-xs"
                onKeyDown={e => e.key === "Enter" && handleCreateQR()}
              />
              <Button
                size="sm"
                className="w-full h-7 text-xs"
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
