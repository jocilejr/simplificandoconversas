import { memo, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import { X, ArrowRight } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, parseWhatsAppFormatting } from "@/types/chatbot";

interface BlockNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function renderChildBody(child: FlowNodeData) {
  switch (child.type) {
    case "trigger":
      return child.triggerType === "keyword"
        ? `Palavra: "${child.triggerKeyword || "..."}"`
        : child.triggerType === "any_message"
        ? "Qualquer mensagem"
        : "Evento específico";
    case "sendText": {
      const text = child.textContent || "Mensagem vazia...";
      const formatted = parseWhatsAppFormatting(text);
      return (
        <span
          dangerouslySetInnerHTML={{ __html: formatted }}
          className="whitespace-pre-wrap"
        />
      );
    }
    case "sendAudio":
      return (child.audioUrl ? "🎵 Áudio" : "Sem áudio") +
        (child.simulateRecording ? " · 🔴 Gravando" : "");
    case "sendVideo":
    case "sendImage":
      return child.mediaUrl ? "📎 Mídia carregada" : "Sem mídia";
    case "condition":
      return `Se ${child.conditionField || "campo"} ${child.conditionOperator || "contém"} "${child.conditionValue || "..."}"`;
    case "randomizer":
      return `${child.paths || 2} caminhos`;
    case "waitDelay":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          ⏳ Aguardando por {child.delaySeconds || 0} segundos...
          {child.simulateTyping && " · ✍️ digitando"}
        </span>
      );
    case "waitForReply":
      return `💭 → {{${child.replyVariable || "resposta"}}}` +
        (child.replyTimeout ? ` · ⏱️ ${child.replyTimeout}s` : "");
    case "action":
      return child.actionType === "add_tag"
        ? `🏷️ ${child.actionValue || "..."}`
        : child.actionType === "add_to_list"
        ? `📋 ${child.actionValue || "..."}`
        : child.actionType === "set_variable"
        ? `📝 ${child.actionValue || "..."}`
        : "Sem ação";
    default:
      return "";
  }
}

function BlockNode({ id, data, selected }: BlockNodeProps) {
  const nodeData = data as FlowNodeData;
  const children = nodeData.children || [];

  // Use first child's type for the header color, fallback to sendText
  const firstChild = children[0];
  const headerType = firstChild?.type || "sendText";
  const headerConfig = nodeTypeConfig[headerType];

  return (
    <div
      className={`
        relative min-w-[260px] max-w-[300px] rounded-xl border bg-card shadow-lg transition-all
        ${selected ? "ring-2 ring-primary shadow-xl" : "hover:shadow-xl"}
      `}
      style={{ borderColor: headerConfig?.color || "hsl(var(--border))" }}
    >
      {/* Single input handle on left top */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-left-1.5 !top-5"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-xl text-white text-xs font-semibold"
        style={{ backgroundColor: headerConfig?.color || "#666" }}
      >
        <span className="text-sm">{headerConfig?.icon}</span>
        <span>WhatsApp - {headerConfig?.label}</span>
      </div>

      {/* Stacked children */}
      <div className="divide-y divide-border">
        {children.length === 0 && (
          <div className="px-3 py-3 text-xs text-muted-foreground italic">
            Arraste componentes aqui...
          </div>
        )}
        {children.map((child, index) => {
          const childConfig = nodeTypeConfig[child.type];
          const isDelay = child.type === "waitDelay";

          return (
            <div
              key={child.childId || index}
              className={`
                group relative px-3 py-2 cursor-pointer hover:bg-secondary/50 transition-colors
                ${isDelay ? "bg-muted/30 py-1.5" : ""}
              `}
              data-child-id={child.childId}
              data-child-index={index}
            >
              {/* Remove button */}
              <button
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                data-remove-child={index}
                onClick={(e) => e.stopPropagation()}
              >
                <X className="h-3 w-3" />
              </button>

              {!isDelay && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">{childConfig?.icon}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {childConfig?.label}
                  </span>
                </div>
              )}

              <div className={`text-xs text-foreground ${isDelay ? "" : "line-clamp-3"}`}>
                {renderChildBody(child)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: Próximo Passo with output handle */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-b-xl border-t border-border bg-muted/30"
      >
        <span className="text-[10px] text-muted-foreground font-medium">Próximo Passo</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Single output handle on right bottom */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-right-1.5"
        style={{ top: "auto", bottom: "14px" }}
      />
    </div>
  );
}

export default memo(BlockNode);
