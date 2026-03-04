import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons, Clock, MessageSquare, Mic, Image, Video, GitBranch, Shuffle, MessageCircle, Settings, ArrowRight } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, type FlowStepData, parseWhatsAppFormatting } from "@/types/chatbot";

interface GroupNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function StepRenderer({ step }: { step: FlowStepData }) {
  const d = step.data;
  const config = nodeTypeConfig[d.type];

  switch (d.type) {
    case "sendText": {
      const text = d.textContent || "Mensagem vazia...";
      return (
        <div className="px-3 py-2">
          <div className="bg-secondary/80 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-foreground leading-relaxed">
            <span
              dangerouslySetInnerHTML={{ __html: parseWhatsAppFormatting(text) }}
              className="whitespace-pre-wrap"
            />
          </div>
        </div>
      );
    }

    case "sendAudio":
      return (
        <div className="px-3 py-2">
          <div className="bg-secondary/80 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${config.color}22`, color: config.color }}>
              <Mic className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-1 bg-muted-foreground/20 rounded-full w-full">
                <div className="h-1 rounded-full w-2/3" style={{ backgroundColor: config.color }} />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">0:00</span>
          </div>
          {d.simulateRecording && (
            <p className="text-[10px] text-muted-foreground mt-1 ml-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Simulando gravação
            </p>
          )}
        </div>
      );

    case "sendImage":
      return (
        <div className="px-3 py-2">
          {d.mediaUrl ? (
            <div className="rounded-xl overflow-hidden border border-border/30">
              <img src={d.mediaUrl} alt="" className="w-full h-28 object-cover" />
              {d.caption && <p className="text-[11px] text-muted-foreground px-2 py-1.5">{d.caption}</p>}
            </div>
          ) : (
            <div className="bg-secondary/80 rounded-xl px-3 py-4 flex flex-col items-center gap-1.5">
              <Image className="w-6 h-6 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground">Sem imagem</span>
            </div>
          )}
        </div>
      );

    case "sendVideo":
      return (
        <div className="px-3 py-2">
          {d.mediaUrl ? (
            <div className="rounded-xl overflow-hidden border border-border/30 relative">
              <div className="w-full h-28 bg-black/80 flex items-center justify-center">
                <Video className="w-8 h-8 text-white/60" />
              </div>
              {d.caption && <p className="text-[11px] text-muted-foreground px-2 py-1.5">{d.caption}</p>}
            </div>
          ) : (
            <div className="bg-secondary/80 rounded-xl px-3 py-4 flex flex-col items-center gap-1.5">
              <Video className="w-6 h-6 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground">Sem vídeo</span>
            </div>
          )}
        </div>
      );

    case "waitDelay":
      return (
        <div className="px-3 py-2 flex justify-center">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border"
            style={{ borderColor: `${config.color}40`, backgroundColor: `${config.color}10` }}
          >
            <Clock className="w-3 h-3" style={{ color: config.color }} />
            <span className="text-[11px] font-medium" style={{ color: config.color }}>
              {d.delaySeconds || 0}s
            </span>
            <span className="text-[10px] text-muted-foreground">
              {d.simulateTyping ? "digitando..." : "aguardando"}
            </span>
          </div>
        </div>
      );

    case "waitForReply":
      return (
        <div className="px-3 py-2">
          <div
            className="rounded-xl px-3 py-2.5 border flex items-center gap-2"
            style={{ borderColor: `${config.color}30`, backgroundColor: `${config.color}08` }}
          >
            <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground">Capturar Resposta</p>
              <p className="text-[10px] text-muted-foreground truncate">
                Salvar em {`{{${d.replyVariable || "resposta"}}}`}
                {d.replyTimeout ? ` · Timeout: ${d.replyTimeout}s` : ""}
              </p>
            </div>
          </div>
        </div>
      );

    case "condition":
      return (
        <div className="px-3 py-2">
          <div
            className="rounded-xl px-3 py-2.5 border flex items-center gap-2"
            style={{ borderColor: `${config.color}30`, backgroundColor: `${config.color}08` }}
          >
            <GitBranch className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
            <p className="text-[11px] text-foreground truncate">
              Se <strong>{d.conditionField || "campo"}</strong> {d.conditionOperator || "contém"} "<em>{d.conditionValue || "..."}</em>"
            </p>
          </div>
        </div>
      );

    case "randomizer":
      return (
        <div className="px-3 py-2">
          <div
            className="rounded-xl px-3 py-2.5 border flex items-center gap-2"
            style={{ borderColor: `${config.color}30`, backgroundColor: `${config.color}08` }}
          >
            <Shuffle className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
            <p className="text-[11px] text-foreground">{d.paths || 2} caminhos aleatórios</p>
          </div>
        </div>
      );

    case "action":
      return (
        <div className="px-3 py-2">
          <div
            className="rounded-xl px-3 py-2.5 border flex items-center gap-2"
            style={{ borderColor: `${config.color}30`, backgroundColor: `${config.color}08` }}
          >
            <Settings className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
            <p className="text-[11px] text-foreground truncate">
              {d.actionType === "add_tag" ? `Adicionar tag: ${d.actionValue || "..."}` :
               d.actionType === "remove_tag" ? `Remover tag: ${d.actionValue || "..."}` :
               d.actionType === "add_to_list" ? `Adicionar à lista: ${d.actionValue || "..."}` :
               d.actionType === "set_variable" ? `Definir variável: ${d.actionValue || "..."}` :
               "Sem ação"}
            </p>
          </div>
        </div>
      );

    default:
      return (
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground">{d.label || "Step"}</p>
        </div>
      );
  }
}

function GroupNode({ id, data, selected }: GroupNodeProps) {
  const d = data as FlowNodeData;
  const steps = (d.steps || []) as FlowStepData[];
  const isDockTarget = d.isDockTarget === true;

  // Determine header info from first meaningful step
  const firstStep = steps[0];
  const headerConfig = firstStep ? nodeTypeConfig[firstStep.data.type] : null;

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-left-1.5"
      />

      <div
        className={`w-[280px] rounded-2xl overflow-hidden transition-all duration-200 bg-card border ${
          isDockTarget
            ? "ring-2 ring-blue-500 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            : selected
            ? "shadow-xl ring-2 ring-primary/25 border-primary/40"
            : "shadow-md hover:shadow-lg border-border/50"
        }`}
      >
        {/* Color bar top */}
        <div className="h-[3px] w-full" style={{ backgroundColor: headerConfig?.color || "#6b7280" }} />

        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ backgroundColor: `${headerConfig?.color || "#6b7280"}14` }}
        >
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${headerConfig?.color || "#6b7280"}22`, color: headerConfig?.color || "#6b7280" }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <span className="text-[12px] font-bold text-foreground">
            {d.label || "Enviar Mensagem"}
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">{steps.length} steps</span>
        </div>

        {/* Steps rendered richly */}
        <div className="divide-y divide-border/20">
          {steps.map((step) => (
            <div key={step.id} data-step-id={step.id} className="cursor-pointer hover:bg-secondary/30 transition-colors">
              <StepRenderer step={step} />
            </div>
          ))}
        </div>

        {/* Empty placeholder */}
        {steps.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Grupo vazio — arraste nós para acoplar
          </div>
        )}

        {/* Footer */}
        {steps.length > 0 && (
          <div className="px-3 py-2 border-t border-border/30 flex items-center justify-end gap-1">
            <span className="text-[10px] text-muted-foreground">Próximo passo</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
          </div>
        )}

        {/* Dock indicator */}
        {isDockTarget && (
          <div className="px-3 py-1.5 bg-blue-500/10 border-t border-blue-500/30">
            <p className="text-[10px] text-blue-500 text-center font-medium animate-pulse">
              Solte para acoplar
            </p>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-right-1.5"
      />
    </div>
  );
}

export default memo(GroupNode);
