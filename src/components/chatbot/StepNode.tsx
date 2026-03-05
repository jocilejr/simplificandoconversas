import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons, Clock, Copy } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, parseWhatsAppFormatting } from "@/types/chatbot";

interface StepNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function renderDescription(d: FlowNodeData): React.ReactNode {
  switch (d.type) {
    case "trigger":
      return d.triggerType === "keyword"
        ? `Palavra-chave: "${d.triggerKeyword || "..."}"`
        : d.triggerType === "any_message"
        ? "Qualquer mensagem"
        : "Evento específico";
    case "sendText": {
      const text = d.textContent || "Mensagem vazia...";
      return (
        <span
          dangerouslySetInnerHTML={{ __html: parseWhatsAppFormatting(text) }}
          className="whitespace-pre-wrap"
        />
      );
    }
    case "sendAudio":
      return (d.audioUrl ? "Áudio carregado" : "Sem áudio") +
        (d.simulateRecording ? " · Gravando" : "");
    case "sendVideo":
    case "sendImage":
      return d.mediaUrl ? "Mídia carregada" : "Sem mídia";
    case "condition":
      return `Se ${d.conditionField || "campo"} ${d.conditionOperator || "contém"} "${d.conditionValue || "..."}"`;
    case "randomizer":
      return `${d.paths || 2} caminhos`;
    case "waitDelay":
      return `Aguardar ${d.delaySeconds || 0}s${d.simulateTyping ? " · digitando..." : ""}`;
    case "waitForReply":
      return `Salvar em {{${d.replyVariable || "resposta"}}}${d.replyTimeout ? ` · ${d.replyTimeout}s` : ""}`;
    case "action":
      return d.actionType === "add_tag"
        ? `Tag: ${d.actionValue || "..."}`
        : d.actionType === "remove_tag"
        ? `Remover: ${d.actionValue || "..."}`
        : d.actionType === "add_to_list"
        ? `Lista: ${d.actionValue || "..."}`
        : d.actionType === "set_variable"
        ? `Var: ${d.actionValue || "..."}`
        : "Sem ação";
    case "aiAgent": {
      const model = d.aiModel || "gpt-4o";
      const prompt = d.aiSystemPrompt ? d.aiSystemPrompt.substring(0, 40) + (d.aiSystemPrompt.length > 40 ? "..." : "") : "Sem prompt";
      return `${model} · ${prompt}`;
    }
    default:
      return "";
  }
}

function StepNode({ id: nodeId, data, selected }: StepNodeProps) {
  const d = data as FlowNodeData;
  const config = nodeTypeConfig[d.type];
  const LucideIcon = icons[config.icon as keyof typeof icons];
  const isTrigger = d.type === "trigger";
  const hasMultipleOutputs = d.type === "condition" || d.type === "randomizer";
  const pathCount = d.type === "randomizer" ? (d.paths || 2) : 2;
  const isDockTarget = d.isDockTarget === true;
  const accentColor = config.color;

  // Timeout-based dual outputs for waitForReply and waitForClick
  const hasTimeoutOutputs =
    (d.type === "waitForReply" && (d.replyTimeout || 0) > 0) ||
    (d.type === "waitForClick" && (d.clickTimeout || 0) > 0);
  const timeoutLabel =
    d.type === "waitForReply" ? "Se não respondeu" : "Se não clicou";

  const dispatchDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    document.dispatchEvent(new CustomEvent("node-duplicate", { detail: { nodeId: (data as any).__nodeId || "" }, bubbles: true }));
  };

  // ─── Trigger: special gradient card ───
  if (isTrigger) {
    return (
      <div className="relative">
        <div
          className={`w-[260px] rounded-xl overflow-hidden transition-all duration-200 ${
            selected ? "shadow-xl ring-2 ring-primary/30" : "shadow-md hover:shadow-lg"
          }`}
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              {LucideIcon && <LucideIcon className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-[13px] font-semibold text-white tracking-wide">{d.label || "Gatilho"}</span>
          </div>
          <div className="px-3 py-2.5 bg-black/10 backdrop-blur-sm">
            <p className="text-[12px] text-white/80 font-medium">{renderDescription(d)}</p>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full"
          style={{ background: accentColor }}
        />
      </div>
    );
  }

  // ─── Regular node — GroupNode-style card ───
  return (
    <div className="relative group/node">
      {/* Duplicate button — visible on hover */}
      <button
        className="absolute -top-3 -right-3 z-50 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover/node:opacity-100 transition-opacity shadow-lg hover:scale-110 nopan nodrag"
        onClick={dispatchDuplicate}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full"
        style={{ background: accentColor }}
      />

      <div
        className={`w-[260px] rounded-xl overflow-hidden transition-all duration-200 bg-card border ${
          isDockTarget
            ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            : selected
            ? "border-primary/40 shadow-xl"
            : "border-border shadow-md hover:shadow-lg"
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50"
          style={{ borderTop: `3px solid ${accentColor}` }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            {LucideIcon && <LucideIcon className="w-3.5 h-3.5" />}
          </div>
          <p className="text-[13px] font-semibold text-foreground flex-1 truncate">
            {d.label || config.label}
          </p>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              {LucideIcon && <LucideIcon className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-foreground truncate">{d.label || config.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{renderDescription(d)}</p>
            </div>
          </div>
        </div>

        {/* Timeout indicator */}
        {hasTimeoutOutputs && (
          <div className="px-3 pb-2.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-orange-500" />
            <span className="text-[10px] text-orange-500 font-medium">
              Timeout: {d.type === "waitForReply" ? d.replyTimeout : d.clickTimeout}
              {(d.type === "waitForReply" ? d.replyTimeoutUnit : d.clickTimeoutUnit) === "seconds" ? "s" :
               (d.type === "waitForReply" ? d.replyTimeoutUnit : d.clickTimeoutUnit) === "hours" ? "h" : "min"}
            </span>
          </div>
        )}

        {/* Dock indicator */}
        {isDockTarget && (
          <div className="px-3 py-2 bg-blue-500/10 border-t border-blue-500/30">
            <p className="text-[11px] text-blue-500 text-center font-medium animate-pulse">
              Solte para acoplar
            </p>
          </div>
        )}
      </div>

      {hasMultipleOutputs ? (
        Array.from({ length: pathCount }).map((_, i) => (
          <Handle
            key={`output-${i}`}
            type="source"
            position={Position.Right}
            id={`output-${i}`}
            className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full"
            style={{ background: accentColor, top: `${((i + 1) / (pathCount + 1)) * 100}%` }}
          />
        ))
      ) : hasTimeoutOutputs ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="output-0"
            className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full"
            style={{ background: accentColor, top: "35%" }}
          />
          <span
            className="absolute text-[9px] font-medium text-muted-foreground whitespace-nowrap pointer-events-none"
            style={{ left: "calc(100% + 14px)", top: "35%", transform: "translateY(-50%)" }}
          >
            Respondeu ✓
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id="output-1"
            className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full"
            style={{ background: "#f97316", top: "70%" }}
          />
          <span
            className="absolute text-[9px] font-medium whitespace-nowrap pointer-events-none"
            style={{ left: "calc(100% + 14px)", top: "70%", transform: "translateY(-50%)", color: "#f97316" }}
          >
            {timeoutLabel} ⏱
          </span>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full"
          style={{ background: accentColor }}
        />
      )}
    </div>
  );
}

export default memo(StepNode);
