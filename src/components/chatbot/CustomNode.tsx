import { memo, type FC } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { nodeTypeConfig, type FlowNodeData } from "@/types/chatbot";

const CustomNode: FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as FlowNodeData;
  const config = nodeTypeConfig[nodeData.type];

  const hasMultipleOutputs = nodeData.type === "condition" || nodeData.type === "randomizer";
  const pathCount = nodeData.type === "randomizer" ? (nodeData.paths || 2) : 2;

  return (
    <div
      className={`
        relative min-w-[200px] max-w-[260px] rounded-xl border-2 bg-card shadow-lg transition-all
        ${selected ? "ring-2 ring-primary shadow-xl scale-[1.02]" : "hover:shadow-xl"}
      `}
      style={{ borderColor: config?.color || "#666" }}
    >
      {/* Input handle */}
      {nodeData.type !== "trigger" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground"
        />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-[10px] text-white text-xs font-semibold"
        style={{ backgroundColor: config?.color || "#666" }}
      >
        <span className="text-sm">{config?.icon}</span>
        <span>{config?.label}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-3 text-xs text-foreground space-y-1">
        {nodeData.type === "trigger" && (
          <p className="text-muted-foreground">
            {nodeData.triggerType === "keyword"
              ? `Palavra: "${nodeData.triggerKeyword || "..."}"`
              : nodeData.triggerType === "any_message"
              ? "Qualquer mensagem"
              : "Evento específico"}
          </p>
        )}

        {nodeData.type === "sendText" && (
          <p className="text-muted-foreground line-clamp-3">
            {nodeData.textContent || "Mensagem vazia..."}
          </p>
        )}

        {nodeData.type === "sendAudio" && (
          <div className="space-y-1">
            <p className="text-muted-foreground">
              {nodeData.audioUrl ? "🎵 Áudio carregado" : "Sem áudio"}
            </p>
            {nodeData.simulateRecording && (
              <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-[10px]">
                🔴 Simular gravação
              </span>
            )}
          </div>
        )}

        {(nodeData.type === "sendVideo" || nodeData.type === "sendImage") && (
          <p className="text-muted-foreground">
            {nodeData.mediaUrl ? "📎 Mídia carregada" : "Sem mídia"}
          </p>
        )}

        {nodeData.type === "condition" && (
          <p className="text-muted-foreground">
            Se {nodeData.conditionField || "campo"}{" "}
            {nodeData.conditionOperator || "contém"}{" "}
            "{nodeData.conditionValue || "..."}"
          </p>
        )}

        {nodeData.type === "randomizer" && (
          <p className="text-muted-foreground">
            {nodeData.paths || 2} caminhos aleatórios
          </p>
        )}

        {nodeData.type === "waitDelay" && (
          <div className="space-y-1">
            <p className="text-muted-foreground">
              ⏳ {nodeData.delaySeconds || 0}s de espera
            </p>
            {nodeData.simulateTyping && (
              <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-[10px]">
                ✍️ Digitando...
              </span>
            )}
          </div>
        )}

        {nodeData.type === "action" && (
          <p className="text-muted-foreground">
            {nodeData.actionType === "add_tag"
              ? `🏷️ Tag: ${nodeData.actionValue || "..."}`
              : nodeData.actionType === "add_to_list"
              ? `📋 Lista: ${nodeData.actionValue || "..."}`
              : nodeData.actionType === "set_variable"
              ? `📝 Var: ${nodeData.actionValue || "..."}`
              : "Nenhuma ação configurada"}
          </p>
        )}
      </div>

      {/* Output handles */}
      {hasMultipleOutputs ? (
        Array.from({ length: pathCount }).map((_, i) => (
          <Handle
            key={`output-${i}`}
            type="source"
            position={Position.Bottom}
            id={`output-${i}`}
            className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground"
            style={{
              left: `${((i + 1) / (pathCount + 1)) * 100}%`,
            }}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground"
        />
      )}
    </div>
  );
};

export default memo(CustomNode);
