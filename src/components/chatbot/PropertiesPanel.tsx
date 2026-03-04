import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Trash2, Unlink, icons } from "lucide-react";
import { type FlowNode, type FlowNodeData, type FlowStepData, nodeTypeConfig } from "@/types/chatbot";
import { TextFormatToolbar } from "@/components/chatbot/TextFormatToolbar";
import { MediaUpload } from "@/components/chatbot/MediaUpload";

interface PropertiesPanelProps {
  node: FlowNode;
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string | null) => void;
  onUpdate: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onUpdateStep?: (nodeId: string, stepId: string, data: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  onRemoveStep?: (nodeId: string, stepId: string) => void;
  onClose: () => void;
}

function StepFields({ d, update }: { d: FlowNodeData; update: (changes: Partial<FlowNodeData>) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs">Nome</Label>
        <Input value={d.label} onChange={(e) => update({ label: e.target.value })} className="h-8 text-xs" />
      </div>

      {/* Trigger */}
      {d.type === "trigger" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de gatilho</Label>
            <Select value={d.triggerType || "keyword"} onValueChange={(v) => update({ triggerType: v as any })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Palavra-chave</SelectItem>
                <SelectItem value="any_message">Qualquer mensagem</SelectItem>
                <SelectItem value="event">Evento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(d.triggerType === "keyword" || !d.triggerType) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Palavra-chave</Label>
              <Input value={d.triggerKeyword || ""} onChange={(e) => update({ triggerKeyword: e.target.value })} placeholder="Ex: oi, olá, menu" className="h-8 text-xs" />
            </div>
          )}
        </>
      )}

      {/* Send Text */}
      {d.type === "sendText" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Mensagem</Label>
          <TextFormatToolbar textareaRef={textareaRef} value={d.textContent || ""} onChange={(v) => update({ textContent: v })} />
          <Textarea ref={textareaRef} value={d.textContent || ""} onChange={(e) => update({ textContent: e.target.value })} placeholder="Use *negrito*, _itálico_, ~riscado~" className="text-xs min-h-[100px] resize-none font-mono" />
          <p className="text-[10px] text-muted-foreground">*negrito*, _itálico_, ~riscado~ · {"{{variável}}"}</p>
        </div>
      )}

      {/* Send Audio */}
      {d.type === "sendAudio" && (
        <>
          <MediaUpload label="Áudio" value={d.audioUrl || ""} accept="audio/*" onChange={(url) => update({ audioUrl: url })} />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Simular gravação</Label>
            <Switch checked={d.simulateRecording || false} onCheckedChange={(v) => update({ simulateRecording: v })} />
          </div>
        </>
      )}

      {/* Send Image */}
      {d.type === "sendImage" && (
        <>
          <MediaUpload label="Imagem" value={d.mediaUrl || ""} accept="image/*" onChange={(url) => update({ mediaUrl: url })} />
          <div className="space-y-1.5">
            <Label className="text-xs">Legenda</Label>
            <Input value={d.caption || ""} onChange={(e) => update({ caption: e.target.value })} placeholder="Legenda opcional" className="h-8 text-xs" />
          </div>
        </>
      )}

      {/* Send Video */}
      {d.type === "sendVideo" && (
        <>
          <MediaUpload label="Vídeo" value={d.mediaUrl || ""} accept="video/*" onChange={(url) => update({ mediaUrl: url })} />
          <div className="space-y-1.5">
            <Label className="text-xs">Legenda</Label>
            <Input value={d.caption || ""} onChange={(e) => update({ caption: e.target.value })} placeholder="Legenda opcional" className="h-8 text-xs" />
          </div>
        </>
      )}

      {/* Condition */}
      {d.type === "condition" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo</Label>
            <Input value={d.conditionField || ""} onChange={(e) => update({ conditionField: e.target.value })} placeholder="Ex: mensagem" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Operador</Label>
            <Select value={d.conditionOperator || "contains"} onValueChange={(v) => update({ conditionOperator: v as any })}>
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
            <Input value={d.conditionValue || ""} onChange={(e) => update({ conditionValue: e.target.value })} placeholder="Valor para comparar" className="h-8 text-xs" />
          </div>
        </>
      )}

      {/* Randomizer */}
      {d.type === "randomizer" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Número de caminhos</Label>
          <Select value={String(d.paths || 2)} onValueChange={(v) => update({ paths: parseInt(v) })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} caminhos</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Wait/Delay */}
      {d.type === "waitDelay" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Tempo de espera (segundos)</Label>
            <Input type="number" value={d.delaySeconds || 0} onChange={(e) => update({ delaySeconds: parseInt(e.target.value) || 0 })} className="h-8 text-xs" min={0} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Simular "digitando..."</Label>
            <Switch checked={d.simulateTyping !== false} onCheckedChange={(v) => update({ simulateTyping: v })} />
          </div>
        </>
      )}

      {/* Wait for Reply */}
      {d.type === "waitForReply" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Salvar resposta na variável</Label>
            <Input value={d.replyVariable || ""} onChange={(e) => update({ replyVariable: e.target.value })} placeholder="Ex: resposta, nome" className="h-8 text-xs" />
            <p className="text-[10px] text-muted-foreground">Acesse com {"{{resposta}}"}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Timeout (segundos)</Label>
            <Input type="number" value={d.replyTimeout || 0} onChange={(e) => update({ replyTimeout: parseInt(e.target.value) || 0 })} className="h-8 text-xs" min={0} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem de fallback</Label>
            <Textarea value={d.replyFallback || ""} onChange={(e) => update({ replyFallback: e.target.value })} placeholder="Mensagem caso não responda" className="text-xs min-h-[60px] resize-none" />
          </div>
        </>
      )}

      {/* Action */}
      {d.type === "action" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de ação</Label>
            <Select value={d.actionType || "add_tag"} onValueChange={(v) => update({ actionType: v as any })}>
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
            <Input value={d.actionValue || ""} onChange={(e) => update({ actionValue: e.target.value })} placeholder="Nome da tag, lista ou variável" className="h-8 text-xs" />
          </div>
        </>
      )}
    </>
  );
}

export function PropertiesPanel({ node, selectedStepId, onSelectStep, onUpdate, onUpdateStep, onDelete, onRemoveStep, onClose }: PropertiesPanelProps) {
  const d = node.data as FlowNodeData;
  const isGroup = d.type === "groupBlock" && d.steps;

  // For groups, show step list or step editor
  if (isGroup) {
    const steps = d.steps || [];
    const activeStep = selectedStepId ? steps.find((s) => s.id === selectedStepId) : null;

    if (activeStep) {
      // Editing a specific step within the group
      const stepConfig = nodeTypeConfig[activeStep.data.type];
      const StepIcon = stepConfig ? icons[stepConfig.icon as keyof typeof icons] : null;

      return (
        <div className="w-72 bg-card border-l border-border h-full overflow-y-auto">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSelectStep?.(null)}>
                <X className="h-3 w-3" />
              </Button>
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${stepConfig?.color}22`, color: stepConfig?.color }}>
                {StepIcon && <StepIcon className="w-3 h-3" />}
              </div>
              <h3 className="text-xs font-semibold">{stepConfig?.label}</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-3 space-y-4">
            <StepFields
              d={activeStep.data}
              update={(changes) => onUpdateStep?.(node.id, activeStep.id, changes)}
            />
            <div className="pt-4 border-t border-border space-y-2">
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => onRemoveStep?.(node.id, activeStep.id)}>
                <Unlink className="h-3 w-3 mr-1" /> Desagrupar Step
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Show group overview with step list
    return (
      <div className="w-72 bg-card border-l border-border h-full overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="text-sm font-semibold">Grupo ({steps.length} steps)</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Clique para editar</p>
          {steps.map((step) => {
            const stepConfig = nodeTypeConfig[step.data.type];
            const StepIcon = stepConfig ? icons[stepConfig.icon as keyof typeof icons] : null;
            return (
              <button
                key={step.id}
                className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                onClick={() => onSelectStep?.(step.id)}
              >
                <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: stepConfig?.color }} />
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${stepConfig?.color}22`, color: stepConfig?.color }}>
                  {StepIcon && <StepIcon className="w-3 h-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{step.data.label || stepConfig?.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{stepConfig?.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-border">
          <Button variant="destructive" size="sm" className="w-full text-xs" onClick={() => onDelete(node.id)}>
            <Trash2 className="h-3 w-3 mr-1" /> Excluir Grupo
          </Button>
        </div>
      </div>
    );
  }

  // Regular standalone node
  const config = nodeTypeConfig[d.type];
  const LucideIcon = icons[config.icon as keyof typeof icons];

  return (
    <div className="w-72 bg-card border-l border-border h-full overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${config.color}22`, color: config.color }}>
            {LucideIcon && <LucideIcon className="w-3.5 h-3.5" />}
          </div>
          <h3 className="text-sm font-semibold">{config.label}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-3 space-y-4">
        <StepFields d={d} update={(changes) => onUpdate(node.id, changes)} />
        <div className="pt-4 border-t border-border">
          <Button variant="destructive" size="sm" className="w-full text-xs" onClick={() => onDelete(node.id)}>
            <Trash2 className="h-3 w-3 mr-1" /> Excluir Nó
          </Button>
        </div>
      </div>
    </div>
  );
}
