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
  node: FlowNode | null;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function PropertiesPanel({ node, onUpdate, onDelete, onClose }: PropertiesPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!node) return null;

  const data = node.data as FlowNodeData;
  const config = nodeTypeConfig[data.type];

  const update = (changes: Partial<FlowNodeData>) => {
    onUpdate(node.id, changes);
  };

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

      <div className="p-3 space-y-4">
        {/* Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Nome do nó</Label>
          <Input
            value={data.label}
            onChange={(e) => update({ label: e.target.value })}
            className="h-8 text-xs"
          />
        </div>

        {/* Trigger */}
        {data.type === "trigger" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de gatilho</Label>
              <Select
                value={data.triggerType || "keyword"}
                onValueChange={(v) => update({ triggerType: v as any })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="any_message">Qualquer mensagem</SelectItem>
                  <SelectItem value="event">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(data.triggerType === "keyword" || !data.triggerType) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Palavra-chave</Label>
                <Input
                  value={data.triggerKeyword || ""}
                  onChange={(e) => update({ triggerKeyword: e.target.value })}
                  placeholder="Ex: oi, olá, menu"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </>
        )}

        {/* Send Text with formatting toolbar */}
        {data.type === "sendText" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem</Label>
            <TextFormatToolbar
              textareaRef={textareaRef}
              value={data.textContent || ""}
              onChange={(v) => update({ textContent: v })}
            />
            <Textarea
              ref={textareaRef}
              value={data.textContent || ""}
              onChange={(e) => update({ textContent: e.target.value })}
              placeholder="Use *negrito*, _itálico_, ~riscado~ e {{nome}} para variáveis"
              className="text-xs min-h-[100px] resize-none font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Formatação: *negrito*, _itálico_, ~riscado~ · Variáveis: {"{{nome}}"}, {"{{telefone}}"}
            </p>
          </div>
        )}

        {/* Send Audio */}
        {data.type === "sendAudio" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">URL do Áudio</Label>
              <Input
                value={data.audioUrl || ""}
                onChange={(e) => update({ audioUrl: e.target.value })}
                placeholder="https://..."
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Simular gravação</Label>
              <Switch
                checked={data.simulateRecording || false}
                onCheckedChange={(v) => update({ simulateRecording: v })}
              />
            </div>
          </>
        )}

        {/* Send Video / Image */}
        {(data.type === "sendVideo" || data.type === "sendImage") && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">URL da Mídia</Label>
              <Input
                value={data.mediaUrl || ""}
                onChange={(e) => update({ mediaUrl: e.target.value })}
                placeholder="https://..."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Legenda</Label>
              <Input
                value={data.caption || ""}
                onChange={(e) => update({ caption: e.target.value })}
                placeholder="Legenda opcional"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {/* Condition */}
        {data.type === "condition" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Campo</Label>
              <Input
                value={data.conditionField || ""}
                onChange={(e) => update({ conditionField: e.target.value })}
                placeholder="Ex: mensagem, variável"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operador</Label>
              <Select
                value={data.conditionOperator || "contains"}
                onValueChange={(v) => update({ conditionOperator: v as any })}
              >
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
              <Input
                value={data.conditionValue || ""}
                onChange={(e) => update({ conditionValue: e.target.value })}
                placeholder="Valor para comparar"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {/* Randomizer */}
        {data.type === "randomizer" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Número de caminhos</Label>
            <Select
              value={String(data.paths || 2)}
              onValueChange={(v) => update({ paths: parseInt(v) })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 caminhos</SelectItem>
                <SelectItem value="3">3 caminhos</SelectItem>
                <SelectItem value="4">4 caminhos</SelectItem>
                <SelectItem value="5">5 caminhos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Wait/Delay */}
        {data.type === "waitDelay" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Tempo de espera (segundos)</Label>
              <Input
                type="number"
                value={data.delaySeconds || 0}
                onChange={(e) => update({ delaySeconds: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs"
                min={0}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Simular "digitando..."</Label>
              <Switch
                checked={data.simulateTyping !== false}
                onCheckedChange={(v) => update({ simulateTyping: v })}
              />
            </div>
          </>
        )}

        {/* Wait for Reply */}
        {data.type === "waitForReply" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Salvar resposta na variável</Label>
              <Input
                value={data.replyVariable || ""}
                onChange={(e) => update({ replyVariable: e.target.value })}
                placeholder="Ex: resposta, nome, email"
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Acesse com {"{{resposta}}"} nos próximos nós
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timeout (segundos, 0 = sem limite)</Label>
              <Input
                type="number"
                value={data.replyTimeout || 0}
                onChange={(e) => update({ replyTimeout: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs"
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem de fallback (timeout)</Label>
              <Textarea
                value={data.replyFallback || ""}
                onChange={(e) => update({ replyFallback: e.target.value })}
                placeholder="Mensagem caso não responda a tempo"
                className="text-xs min-h-[60px] resize-none"
              />
            </div>
          </>
        )}

        {/* Action */}
        {data.type === "action" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de ação</Label>
              <Select
                value={data.actionType || "add_tag"}
                onValueChange={(v) => update({ actionType: v as any })}
              >
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
              <Input
                value={data.actionValue || ""}
                onChange={(e) => update({ actionValue: e.target.value })}
                placeholder="Nome da tag, lista ou variável"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {/* Delete */}
        <div className="pt-4 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            className="w-full text-xs"
            onClick={() => onDelete(node.id)}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Excluir Nó
          </Button>
        </div>
      </div>
    </div>
  );
}
