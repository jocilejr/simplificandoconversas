import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Trash2 } from "lucide-react";
import { type FlowNode, type FlowNodeData, nodeTypeConfig } from "@/types/chatbot";
import { TextFormatToolbar } from "@/components/chatbot/TextFormatToolbar";

interface PropertiesPanelProps {
  node: FlowNode;
  childIndex: number;
  onUpdateChild: (nodeId: string, childIndex: number, data: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function PropertiesPanel({ node, childIndex, onUpdateChild, onDelete, onClose }: PropertiesPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const nodeData = node.data as FlowNodeData;
  const children = nodeData.children || [];
  const child = children[childIndex];
  if (!child) return null;

  const config = nodeTypeConfig[child.type];
  const update = (changes: Partial<FlowNodeData>) => onUpdateChild(node.id, childIndex, changes);

  return (
    <div className="w-72 bg-card border-l border-border h-full overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span>{config.icon}</span>
          <h3 className="text-sm font-semibold">{config.label}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Child selector tabs */}
      {children.length > 1 && (
        <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
          {children.map((c, i) => {
            const cc = nodeTypeConfig[c.type];
            return (
              <button
                key={c.childId || i}
                className={`text-[10px] px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
                  i === childIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
                onClick={() => {
                  // Trigger re-render with new index - parent handles this via click
                }}
              >
                {cc.icon} {cc.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-3 space-y-4">
        {/* Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Nome</Label>
          <Input value={child.label} onChange={(e) => update({ label: e.target.value })} className="h-8 text-xs" />
        </div>

        {/* Trigger */}
        {child.type === "trigger" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de gatilho</Label>
              <Select value={child.triggerType || "keyword"} onValueChange={(v) => update({ triggerType: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="any_message">Qualquer mensagem</SelectItem>
                  <SelectItem value="event">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(child.triggerType === "keyword" || !child.triggerType) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Palavra-chave</Label>
                <Input value={child.triggerKeyword || ""} onChange={(e) => update({ triggerKeyword: e.target.value })} placeholder="Ex: oi, olá, menu" className="h-8 text-xs" />
              </div>
            )}
          </>
        )}

        {/* Send Text */}
        {child.type === "sendText" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem</Label>
            <TextFormatToolbar textareaRef={textareaRef} value={child.textContent || ""} onChange={(v) => update({ textContent: v })} />
            <Textarea ref={textareaRef} value={child.textContent || ""} onChange={(e) => update({ textContent: e.target.value })} placeholder="Use *negrito*, _itálico_, ~riscado~" className="text-xs min-h-[100px] resize-none font-mono" />
            <p className="text-[10px] text-muted-foreground">*negrito*, _itálico_, ~riscado~ · {"{{variável}}"}</p>
          </div>
        )}

        {/* Send Audio */}
        {child.type === "sendAudio" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">URL do Áudio</Label>
              <Input value={child.audioUrl || ""} onChange={(e) => update({ audioUrl: e.target.value })} placeholder="https://..." className="h-8 text-xs" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Simular gravação</Label>
              <Switch checked={child.simulateRecording || false} onCheckedChange={(v) => update({ simulateRecording: v })} />
            </div>
          </>
        )}

        {/* Send Video / Image */}
        {(child.type === "sendVideo" || child.type === "sendImage") && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">URL da Mídia</Label>
              <Input value={child.mediaUrl || ""} onChange={(e) => update({ mediaUrl: e.target.value })} placeholder="https://..." className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Legenda</Label>
              <Input value={child.caption || ""} onChange={(e) => update({ caption: e.target.value })} placeholder="Legenda opcional" className="h-8 text-xs" />
            </div>
          </>
        )}

        {/* Condition */}
        {child.type === "condition" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Campo</Label>
              <Input value={child.conditionField || ""} onChange={(e) => update({ conditionField: e.target.value })} placeholder="Ex: mensagem" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operador</Label>
              <Select value={child.conditionOperator || "contains"} onValueChange={(v) => update({ conditionOperator: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">É igual a</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="starts_with">Começa com</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input value={child.conditionValue || ""} onChange={(e) => update({ conditionValue: e.target.value })} placeholder="Valor para comparar" className="h-8 text-xs" />
            </div>
          </>
        )}

        {/* Randomizer */}
        {child.type === "randomizer" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Número de caminhos</Label>
            <Select value={String(child.paths || 2)} onValueChange={(v) => update({ paths: parseInt(v) })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} caminhos</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Wait/Delay */}
        {child.type === "waitDelay" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Tempo de espera (segundos)</Label>
              <Input type="number" value={child.delaySeconds || 0} onChange={(e) => update({ delaySeconds: parseInt(e.target.value) || 0 })} className="h-8 text-xs" min={0} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Simular "digitando..."</Label>
              <Switch checked={child.simulateTyping !== false} onCheckedChange={(v) => update({ simulateTyping: v })} />
            </div>
          </>
        )}

        {/* Wait for Reply */}
        {child.type === "waitForReply" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Salvar resposta na variável</Label>
              <Input value={child.replyVariable || ""} onChange={(e) => update({ replyVariable: e.target.value })} placeholder="Ex: resposta, nome" className="h-8 text-xs" />
              <p className="text-[10px] text-muted-foreground">Acesse com {"{{resposta}}"}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timeout (segundos)</Label>
              <Input type="number" value={child.replyTimeout || 0} onChange={(e) => update({ replyTimeout: parseInt(e.target.value) || 0 })} className="h-8 text-xs" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem de fallback</Label>
              <Textarea value={child.replyFallback || ""} onChange={(e) => update({ replyFallback: e.target.value })} placeholder="Mensagem caso não responda" className="text-xs min-h-[60px] resize-none" />
            </div>
          </>
        )}

        {/* Action */}
        {child.type === "action" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de ação</Label>
              <Select value={child.actionType || "add_tag"} onValueChange={(v) => update({ actionType: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add_tag">Adicionar Tag</SelectItem>
                  <SelectItem value="remove_tag">Remover Tag</SelectItem>
                  <SelectItem value="add_to_list">Adicionar à Lista</SelectItem>
                  <SelectItem value="set_variable">Definir Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input value={child.actionValue || ""} onChange={(e) => update({ actionValue: e.target.value })} placeholder="Nome da tag, lista ou variável" className="h-8 text-xs" />
            </div>
          </>
        )}

        {/* Delete block */}
        <div className="pt-4 border-t border-border">
          <Button variant="destructive" size="sm" className="w-full text-xs" onClick={() => onDelete(node.id)}>
            <Trash2 className="h-3 w-3 mr-1" /> Excluir Bloco
          </Button>
        </div>
      </div>
    </div>
  );
}
