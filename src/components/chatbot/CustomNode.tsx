import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { nodeTypeConfig, type FlowNodeData } from "@/types/chatbot";

function CustomNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const nodeData = data as FlowNodeData;
  const config = nodeTypeConfig[nodeData.type];

  const hasMultipleOutputs = nodeData.type === "condition" || nodeData.type === "randomizer";
  const pathCount = nodeData.type === "randomizer" ? (nodeData.paths || 2) : 2;

  const renderBody = () => {
    switch (nodeData.type) {
      case "trigger":
        return nodeData.triggerType === "keyword"
          ? `Palavra: "${nodeData.triggerKeyword || "..."}"`
          : nodeData.triggerType === "any_message"
          ? "Qualquer mensagem"
          : "Evento específico";
      case "sendText":
        return nodeData.textContent || "Mensagem vazia...";
      case "sendAudio":
        return (nodeData.audioUrl ? "🎵 Áudio" : "Sem áudio") +
          (nodeData.simulateRecording ? " · 🔴 Gravando" : "");
      case "sendVideo":
      case "sendImage":
        return nodeData.mediaUrl ? "📎 Mídia carregada" : "Sem mídia";
      case "condition":
        return `Se ${nodeData.conditionField || "campo"} ${nodeData.conditionOperator || "contém"} "${nodeData.conditionValue || "..."}"`;
      case "randomizer":
        return `${nodeData.paths || 2} caminhos`;
      case "waitDelay":
        return `⏳ ${nodeData.delaySeconds || 0}s` + (nodeData.simulateTyping ? " · ✍️" : "");
      case "action":
        return nodeData.actionType === "add_tag"
          ? `🏷️ ${nodeData.actionValue || "..."}`
          : nodeData.actionType === "add_to_list"
          ? `📋 ${nodeData.actionValue || "..."}`
          : nodeData.actionType === "set_variable"
          ? `📝 ${nodeData.actionValue || "..."}`
          : "Sem ação";
      default:
        return "";
    }
  };

  return (
    <div
      className={`
        relative min-w-[220px] max-w-[280px] rounded-lg border-2 bg-card shadow-md transition-all
        ${selected ? "ring-2 ring-primary shadow-xl scale-[1.02]" : "hover:shadow-lg"}
      `}
      style={{ borderColor: config?.color || "#666" }}
    >
      {nodeData.type !== "trigger" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-left-1.5"
        />
      )}

      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-t-[6px] text-white text-xs font-semibold"
        style={{ backgroundColor: config?.color || "#666" }}
      >
        <span className="text-sm">{config?.icon}</span>
        <span>{config?.label}</span>
      </div>

      <div className="px-3 py-2 text-xs text-muted-foreground line-clamp-2">
        {renderBody()}
      </div>

      {hasMultipleOutputs ? (
        Array.from({ length: pathCount }).map((_, i) => (
          <Handle
            key={`output-${i}`}
            type="source"
            position={Position.Right}
            id={`output-${i}`}
            className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-right-1.5"
            style={{
              top: `${((i + 1) / (pathCount + 1)) * 100}%`,
            }}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-right-1.5"
        />
      )}
    </div>
  );
}

export default memo(CustomNode);
