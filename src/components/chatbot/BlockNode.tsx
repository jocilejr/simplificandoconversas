import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { X, Clock, icons } from "lucide-react";
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
      return null; // rendered as inline badge
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
        relative min-w-[260px] max-w-[300px] rounded-xl overflow-hidden transition-all duration-200
        bg-card border-2
        ${selected 
          ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)),0_8px_32px_-8px_rgba(0,0,0,0.2)]" 
          : "border-border/60 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
        }
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !rounded-full !border-[1.5px] !bg-muted-foreground/50 !border-card !-left-[5px]"
        style={{ top: 22 }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5"
        style={{ backgroundColor: headerConfig?.color || "#666" }}
      >
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
          {(() => {
            const LucideIcon = icons[headerConfig?.icon as keyof typeof icons];
            return LucideIcon ? <LucideIcon className="w-3 h-3 text-white" /> : null;
          })()}
        </div>
        <div className="flex flex-col">
          <span className="text-white text-[10px] font-medium opacity-80">WhatsApp</span>
          <span className="text-white text-[12px] font-semibold leading-tight">{nodeData.label || headerConfig?.label}</span>
        </div>
      </div>

      {/* Children */}
      <div className="px-3 py-2 space-y-2">
        {children.length === 0 && (
          <div className="py-3 text-[11px] text-muted-foreground text-center">
            Arraste componentes aqui
          </div>
        )}
        {children.map((child, index) => {
          const isDelay = child.type === "waitDelay";

          if (isDelay) {
            return (
              <div
                key={child.childId || index}
                className="group relative flex items-center justify-center"
                data-child-id={child.childId}
                data-child-index={index}
              >
                <div className="flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Aguardando por {child.delaySeconds || 0} segundos...
                  </span>
                </div>
                <button
                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full bg-card border border-border text-muted-foreground hover:text-destructive"
                  data-remove-child={index}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={child.childId || index}
              className="group relative bg-muted/30 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
              data-child-id={child.childId}
              data-child-index={index}
            >
              <button
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/40 hover:text-destructive"
                data-remove-child={index}
              >
                <X className="h-3 w-3" />
              </button>

              <div className="text-[12px] leading-[1.6] text-foreground/85">
                {renderChildContent(child)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center px-3 py-2 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wide">Próximo Passo</span>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !rounded-full !border-[1.5px] !bg-muted-foreground/50 !border-card !-right-[5px]"
        style={{ top: "auto", bottom: 14 }}
      />
    </div>
  );
}

export default memo(BlockNode);
