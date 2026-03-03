import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { ArrowRight, X } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, parseWhatsAppFormatting } from "@/types/chatbot";

interface BlockNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function renderChildContent(child: FlowNodeData) {
  switch (child.type) {
    case "trigger":
      return child.triggerType === "keyword"
        ? `Palavra: "${child.triggerKeyword || "..."}"`
        : child.triggerType === "any_message"
        ? "Qualquer mensagem"
        : "Evento específico";
    case "sendText": {
      const text = child.textContent || "Mensagem vazia...";
      return (
        <span
          dangerouslySetInnerHTML={{ __html: parseWhatsAppFormatting(text) }}
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
      return `⏳ Aguardando por ${child.delaySeconds || 0} segundos...${child.simulateTyping ? " · ✍️ digitando" : ""}`;
    case "waitForReply":
      return `💭 → {{${child.replyVariable || "resposta"}}}${child.replyTimeout ? ` · ⏱️ ${child.replyTimeout}s` : ""}`;
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
  const firstChild = children[0];
  const headerType = firstChild?.type || "sendText";
  const headerConfig = nodeTypeConfig[headerType];

  return (
    <div
      className={`
        relative min-w-[240px] max-w-[280px] rounded-lg overflow-hidden transition-shadow
        ${selected ? "shadow-[0_0_0_2px_hsl(var(--primary)),0_8px_24px_-4px_rgba(0,0,0,0.3)]" : "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.15)]"}
      `}
      style={{ 
        background: "hsl(var(--card))",
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !rounded-full !border-2 !bg-muted-foreground/60 !border-card !-left-[5px]"
        style={{ top: 20 }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-[7px] text-[11px] font-semibold tracking-wide"
        style={{ 
          backgroundColor: headerConfig?.color || "#666",
          color: "white",
        }}
      >
        <span className="text-xs leading-none">{headerConfig?.icon}</span>
        <span>WhatsApp - {headerConfig?.label}</span>
      </div>

      {/* Children */}
      <div>
        {children.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-muted-foreground text-center italic">
            Arraste componentes aqui
          </div>
        )}
        {children.map((child, index) => {
          const childConfig = nodeTypeConfig[child.type];
          const isDelay = child.type === "waitDelay";
          const isLast = index === children.length - 1;

          return (
            <div
              key={child.childId || index}
              className={`
                group relative px-3 cursor-pointer transition-colors hover:bg-accent/5
                ${isDelay ? "py-1.5 bg-muted/20" : "py-2"}
                ${!isLast ? "border-b border-border/50" : ""}
              `}
              data-child-id={child.childId}
              data-child-index={index}
            >
              {/* Remove */}
              <button
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-sm text-muted-foreground/40 hover:text-destructive"
                data-remove-child={index}
                onClick={(e) => e.stopPropagation()}
              >
                <X className="h-3 w-3" />
              </button>

              {/* Child type label */}
              {!isDelay && (
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[9px] leading-none">{childConfig?.icon}</span>
                  <span className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-[0.08em]">
                    {childConfig?.label}
                  </span>
                </div>
              )}

              <div className={`text-[12px] leading-relaxed text-foreground/80 ${isDelay ? "text-[10px] text-muted-foreground" : "line-clamp-3"}`}>
                {renderChildContent(child)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-[6px] border-t border-border/40 bg-muted/15">
        <span className="text-[10px] text-muted-foreground/60 font-medium">Próximo Passo</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !rounded-full !border-2 !bg-muted-foreground/60 !border-card !-right-[5px]"
        style={{ top: "auto", bottom: 12 }}
      />
    </div>
  );
}

export default memo(BlockNode);
