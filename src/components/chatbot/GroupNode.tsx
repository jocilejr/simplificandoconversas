import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, type FlowStepData, parseWhatsAppFormatting } from "@/types/chatbot";

interface GroupNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function renderStepPreview(d: FlowNodeData): React.ReactNode {
  switch (d.type) {
    case "sendText":
      return d.textContent
        ? <span dangerouslySetInnerHTML={{ __html: parseWhatsAppFormatting(d.textContent.substring(0, 40)) }} />
        : "Mensagem vazia...";
    case "sendAudio":
      return d.audioUrl ? "🎵 Áudio" : "Sem áudio";
    case "sendImage":
    case "sendVideo":
      return d.mediaUrl ? "📎 Mídia" : "Sem mídia";
    case "waitDelay":
      return `⏱ ${d.delaySeconds || 0}s`;
    case "waitForReply":
      return `{{${d.replyVariable || "resposta"}}}`;
    case "condition":
      return `Se ${d.conditionField || "..."} ${d.conditionOperator || "contém"} "${d.conditionValue || "..."}"`;
    case "randomizer":
      return `${d.paths || 2} caminhos`;
    case "action":
      return d.actionValue ? `🏷️ ${d.actionValue}` : "Sem ação";
    default:
      return d.label || "";
  }
}

function GroupNode({ id, data, selected }: GroupNodeProps) {
  const d = data as FlowNodeData;
  const steps = (d.steps || []) as FlowStepData[];
  const isDockTarget = d.isDockTarget === true;

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
        {/* Steps stacked */}
        {steps.map((step, index) => {
          const stepConfig = nodeTypeConfig[step.data.type];
          const StepIcon = stepConfig ? icons[stepConfig.icon as keyof typeof icons] : null;

          return (
            <div
              key={step.id}
              className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors ${
                index > 0 ? "border-t border-border/30" : ""
              }`}
              data-step-id={step.id}
            >
              {/* Color bar */}
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: stepConfig?.color || "#6b7280" }}
              />
              <div
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: `${stepConfig?.color || "#6b7280"}22`,
                  color: stepConfig?.color || "#6b7280",
                }}
              >
                {StepIcon && <StepIcon className="w-3 h-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate">
                  {step.data.label || stepConfig?.label || "Step"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {renderStepPreview(step.data)}
                </p>
              </div>
            </div>
          );
        })}

        {/* Empty group placeholder */}
        {steps.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            Grupo vazio
          </div>
        )}

        {/* Dock indicator at bottom */}
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
