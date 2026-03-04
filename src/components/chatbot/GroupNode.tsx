import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { MessageSquare, Clock, Mic, Image, Video, GitBranch, Shuffle, MessageCircle, Settings, ArrowRight } from "lucide-react";
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
        <div className="px-4 py-1.5">
          <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-4 py-2.5 text-[13px] text-foreground leading-relaxed">
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
        <div className="px-4 py-1.5">
          <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
              <Mic className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 bg-muted-foreground/15 rounded-full w-full">
                <div className="h-1.5 rounded-full w-2/3" style={{ backgroundColor: config.color }} />
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground flex-shrink-0">0:00</span>
          </div>
          {d.simulateRecording && (
            <p className="text-[10px] text-muted-foreground mt-1.5 ml-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              Simulando gravação
            </p>
          )}
        </div>
      );

    case "sendImage":
      return (
        <div className="px-4 py-1.5">
          {d.mediaUrl ? (
            <div className="rounded-2xl rounded-bl-sm overflow-hidden border border-border/30">
              <img src={d.mediaUrl} alt="" className="w-full h-32 object-cover" />
              {d.caption && <p className="text-[12px] text-muted-foreground px-3 py-2">{d.caption}</p>}
            </div>
          ) : (
            <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-4 py-5 flex flex-col items-center gap-2">
              <Image className="w-7 h-7 text-muted-foreground/40" />
              <span className="text-[11px] text-muted-foreground">Sem imagem</span>
            </div>
          )}
        </div>
      );

    case "sendVideo":
      return (
        <div className="px-4 py-1.5">
          {d.mediaUrl ? (
            <div className="rounded-2xl rounded-bl-sm overflow-hidden border border-border/30 relative">
              <div className="w-full h-32 bg-foreground/80 flex items-center justify-center">
                <Video className="w-9 h-9 text-background/60" />
              </div>
              {d.caption && <p className="text-[12px] text-muted-foreground px-3 py-2">{d.caption}</p>}
            </div>
          ) : (
            <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-4 py-5 flex flex-col items-center gap-2">
              <Video className="w-7 h-7 text-muted-foreground/40" />
              <span className="text-[11px] text-muted-foreground">Sem vídeo</span>
            </div>
          )}
        </div>
      );

    case "waitDelay":
      return (
        <div className="px-4 py-2.5 flex justify-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 border"
            style={{ borderColor: `${config.color}30`, backgroundColor: `${config.color}08` }}
          >
            <Clock className="w-3.5 h-3.5" style={{ color: config.color }} />
            <span className="text-[12px] text-muted-foreground">
              Aguardando por <strong className="text-foreground">{d.delaySeconds || 0} segundos</strong>...
            </span>
          </div>
        </div>
      );

    case "waitForReply":
      return (
        <div className="px-4 py-1.5">
          <div
            className="rounded-2xl px-4 py-3 border flex items-center gap-2.5"
            style={{ borderColor: `${config.color}25`, backgroundColor: `${config.color}06` }}
          >
            <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-foreground">Capturar Resposta</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Salvar em {`{{${d.replyVariable || "resposta"}}}`}
                {d.replyTimeout ? ` · Timeout: ${d.replyTimeout}s` : ""}
              </p>
            </div>
          </div>
        </div>
      );

    case "condition":
      return (
        <div className="px-4 py-1.5">
          <div
            className="rounded-2xl px-4 py-3 border flex items-center gap-2.5"
            style={{ borderColor: `${config.color}25`, backgroundColor: `${config.color}06` }}
          >
            <GitBranch className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
            <p className="text-[12px] text-foreground truncate">
              Se <strong>{d.conditionField || "campo"}</strong> {d.conditionOperator || "contém"} "<em>{d.conditionValue || "..."}</em>"
            </p>
          </div>
        </div>
      );

    case "randomizer":
      return (
        <div className="px-4 py-1.5">
          <div
            className="rounded-2xl px-4 py-3 border flex items-center gap-2.5"
            style={{ borderColor: `${config.color}25`, backgroundColor: `${config.color}06` }}
          >
            <Shuffle className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
            <p className="text-[12px] text-foreground">{d.paths || 2} caminhos aleatórios</p>
          </div>
        </div>
      );

    case "action":
      return (
        <div className="px-4 py-1.5">
          <div
            className="rounded-2xl px-4 py-3 border flex items-center gap-2.5"
            style={{ borderColor: `${config.color}25`, backgroundColor: `${config.color}06` }}
          >
            <Settings className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
            <p className="text-[12px] text-foreground truncate">
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
        <div className="px-4 py-1.5">
          <p className="text-xs text-muted-foreground">{d.label || "Step"}</p>
        </div>
      );
  }
}

function GroupNode({ id, data, selected }: GroupNodeProps) {
  const d = data as FlowNodeData;
  const steps = (d.steps || []) as FlowStepData[];
  const isDockTarget = d.isDockTarget === true;

  const firstStep = steps[0];
  const headerConfig = firstStep ? nodeTypeConfig[firstStep.data.type] : null;
  const accentColor = headerConfig?.color || "#6b7280";

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-left-1.5"
      />

      <div
        className={`w-[300px] rounded-2xl overflow-hidden transition-all duration-200 bg-card border-l-4 border border-border/40 ${
          isDockTarget
            ? "ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            : selected
            ? "shadow-xl ring-2 ring-primary/20"
            : "shadow-md hover:shadow-lg"
        }`}
        style={{ borderLeftColor: accentColor }}
      >
        {/* Header — two lines */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">WhatsApp</p>
            <p className="text-[13px] font-semibold text-foreground truncate">{d.label || "Enviar Mensagem"}</p>
          </div>
        </div>

        {/* Steps — no dividers, natural spacing */}
        <div className="pb-1">
          {steps.map((step) => (
            <div key={step.id} data-step-id={step.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
              <StepRenderer step={step} />
            </div>
          ))}
        </div>

        {/* Empty state */}
        {steps.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            Grupo vazio — arraste nós para acoplar
          </div>
        )}

        {/* Footer */}
        {steps.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-center gap-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/20" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/20" />
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">Próximo Passo</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
          </div>
        )}

        {/* Dock indicator */}
        {isDockTarget && (
          <div className="px-4 py-2 bg-blue-500/10 border-t border-blue-500/30">
            <p className="text-[11px] text-blue-500 text-center font-medium animate-pulse">
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
