import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { X, Clock, ChevronUp, ChevronDown, icons } from "lucide-react";
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
      return (child.audioUrl ? "Áudio carregado" : "Sem áudio") +
        (child.simulateRecording ? " · Gravando" : "");
    case "sendVideo":
    case "sendImage":
      return child.mediaUrl ? "Mídia carregada" : "Sem mídia";
    case "condition":
      return `Se ${child.conditionField || "campo"} ${child.conditionOperator || "contém"} "${child.conditionValue || "..."}"`;
    case "randomizer":
      return `${child.paths || 2} caminhos`;
    case "waitDelay":
      return null;
    case "waitForReply":
      return `Salvar em {{${child.replyVariable || "resposta"}}}${child.replyTimeout ? ` · ${child.replyTimeout}s` : ""}`;
    case "action":
      return child.actionType === "add_tag"
        ? `Tag: ${child.actionValue || "..."}`
        : child.actionType === "add_to_list"
        ? `Lista: ${child.actionValue || "..."}`
        : child.actionType === "set_variable"
        ? `Variável: ${child.actionValue || "..."}`
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
  const accentColor = headerConfig?.color || "#666";

  return (
    <div
      className={`
        relative w-[280px] rounded-xl transition-all duration-200
        bg-card border
        ${selected
          ? "shadow-lg border-primary/50 ring-2 ring-primary/20"
          : "shadow-sm border-border/60 hover:shadow-md"
        }
      `}
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="block-handle block-handle-target"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-tr-xl"
        style={{ backgroundColor: `${accentColor}12` }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
        >
          {(() => {
            const LucideIcon = icons[headerConfig?.icon as keyof typeof icons];
            return LucideIcon ? <LucideIcon className="w-3.5 h-3.5" /> : null;
          })()}
        </div>
        <span className="text-[13px] font-semibold text-foreground truncate">
          {nodeData.label || headerConfig?.label}
        </span>
      </div>

      {/* Children */}
      <div className="px-1.5 py-1.5">
        {children.length === 0 && (
          <div className="py-5 text-[11px] text-muted-foreground text-center border border-dashed border-border/50 rounded-lg mx-1">
            Arraste componentes aqui
          </div>
        )}
        {children.map((child, index) => {
          const isDelay = child.type === "waitDelay";
          const childConfig = nodeTypeConfig[child.type];
          const ChildIcon = icons[childConfig?.icon as keyof typeof icons];
          const isFirst = index === 0;
          const isLast = index === children.length - 1;

          if (isDelay) {
            return (
              <div
                key={child.childId || index}
                className="group relative flex items-center justify-center py-1"
                data-child-id={child.childId}
                data-child-index={index}
              >
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 border"
                  style={{
                    borderColor: `${childConfig.color}30`,
                    backgroundColor: `${childConfig.color}08`,
                  }}
                >
                  <Clock className="w-3 h-3" style={{ color: childConfig.color }} />
                  <span className="text-[11px] font-medium" style={{ color: childConfig.color }}>
                    {child.delaySeconds || 0}s
                  </span>
                  <span className="text-[10px] text-muted-foreground">aguardando</span>
                </div>
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isFirst && (
                    <button className="p-0.5 rounded bg-card border border-border text-muted-foreground hover:text-foreground" data-move-up={index}>
                      <ChevronUp className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {!isLast && (
                    <button className="p-0.5 rounded bg-card border border-border text-muted-foreground hover:text-foreground" data-move-down={index}>
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  )}
                  <button className="p-0.5 rounded bg-card border border-border text-muted-foreground hover:text-destructive" data-remove-child={index}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={child.childId || index}
              className="group relative rounded-lg cursor-pointer transition-colors hover:bg-muted/30 mx-0.5"
              data-child-id={child.childId}
              data-child-index={index}
            >
              <div className="flex items-start gap-2 px-2.5 py-2">
                <div
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${childConfig?.color}15`, color: childConfig?.color }}
                >
                  {ChildIcon && <ChildIcon className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: childConfig?.color }}>
                    {childConfig?.label}
                  </p>
                  <div className="text-[12px] leading-[1.4] text-foreground/70">
                    {renderChildContent(child)}
                  </div>
                </div>
              </div>

              {/* Separator */}
              {!isLast && (
                <div className="mx-3 border-b border-border/30" />
              )}

              {/* Reorder + remove */}
              <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isFirst && (
                  <button className="p-0.5 rounded bg-card/90 border border-border text-muted-foreground hover:text-foreground" data-move-up={index}>
                    <ChevronUp className="h-3 w-3" />
                  </button>
                )}
                {!isLast && (
                  <button className="p-0.5 rounded bg-card/90 border border-border text-muted-foreground hover:text-foreground" data-move-down={index}>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                )}
                <button className="p-0.5 rounded bg-card/90 border border-border text-muted-foreground/40 hover:text-destructive" data-remove-child={index}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="block-handle block-handle-source"
      />
    </div>
  );
}

export default memo(BlockNode);
