import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { X, Clock, ChevronUp, ChevronDown, ArrowRight, icons } from "lucide-react";
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

  return (
    <div
      className={`
        relative min-w-[270px] max-w-[310px] rounded-2xl overflow-hidden transition-all duration-200
        bg-card
        ${selected
          ? "shadow-[0_0_0_2px_hsl(var(--primary)),0_12px_40px_-12px_rgba(0,0,0,0.25)]"
          : "shadow-[0_2px_12px_-4px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] border border-border/40"
        }
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !rounded-full !border-[2.5px] !border-primary !bg-primary/20 !-left-[8px] hover:!bg-primary hover:!scale-125 transition-all duration-150"
        style={{ top: '50%' }}
      />

      {/* Header with gradient */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{
          background: `linear-gradient(135deg, ${headerConfig?.color || "#666"}, ${headerConfig?.color || "#666"}dd)`,
        }}
      >
        <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
          {(() => {
            const LucideIcon = icons[headerConfig?.icon as keyof typeof icons];
            return LucideIcon ? <LucideIcon className="w-3.5 h-3.5 text-white" /> : null;
          })()}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-white/70 text-[9px] font-semibold uppercase tracking-wider">WhatsApp</span>
          <span className="text-white text-[13px] font-semibold leading-tight truncate">{nodeData.label || headerConfig?.label}</span>
        </div>
      </div>

      {/* Children */}
      <div className="px-2.5 py-2 space-y-1.5">
        {children.length === 0 && (
          <div className="py-4 text-[11px] text-muted-foreground text-center border border-dashed border-border/60 rounded-lg">
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
                className="group relative flex items-center justify-center py-0.5"
                data-child-id={child.childId}
                data-child-index={index}
              >
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 border"
                  style={{
                    borderColor: `${childConfig.color}40`,
                    backgroundColor: `${childConfig.color}10`,
                  }}
                >
                  <Clock className="w-3 h-3" style={{ color: childConfig.color }} />
                  <span className="text-[11px] font-medium" style={{ color: childConfig.color }}>
                    {child.delaySeconds || 0}s
                  </span>
                  <span className="text-[10px] text-muted-foreground">aguardando</span>
                </div>
                {/* Reorder + remove buttons */}
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
              className="group relative rounded-lg overflow-hidden cursor-pointer hover:bg-muted/40 transition-colors"
              data-child-id={child.childId}
              data-child-index={index}
              style={{ borderLeft: `3px solid ${childConfig?.color || '#666'}` }}
            >
              <div className="flex items-start gap-2 px-3 py-2.5">
                {/* Type icon */}
                <div
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${childConfig?.color}15`, color: childConfig?.color }}
                >
                  {ChildIcon && <ChildIcon className="w-3 h-3" />}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: childConfig?.color }}>
                    {childConfig?.label}
                  </p>
                  <div className="text-[12px] leading-[1.5] text-foreground/80">
                    {renderChildContent(child)}
                  </div>
                </div>
              </div>

              {/* Reorder + remove buttons */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-2 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">Próximo Passo</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !rounded-full !border-[2.5px] !border-primary !bg-primary/20 !-right-[8px] hover:!bg-primary hover:!scale-125 transition-all duration-150"
        style={{ top: "auto", bottom: 16 }}
      />
    </div>
  );
}

export default memo(BlockNode);
