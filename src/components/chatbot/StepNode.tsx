import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons, Clock, Copy, Trash2 } from "lucide-react";
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
    case "sendFile":
      return d.fileUrl ? (d.fileName || "Arquivo carregado") : "Sem arquivo";
    case "condition":
      return `Se ${d.conditionField || "campo"} ${d.conditionOperator || "contém"} "${d.conditionValue || "..."}"`;
    case "randomizer":
      return `${d.paths || 2} caminhos`;
    case "waitDelay":
      return `Aguardar ${d.delaySeconds || 0}s${d.delayPresenceType === "recording" ? " · gravando..." : d.delayPresenceType === "composing" ? " · digitando..." : ""}`;
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
    document.dispatchEvent(new CustomEvent("node-duplicate", { detail: { nodeId }, bubbles: true }));
  };

  const dispatchDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    document.dispatchEvent(new CustomEvent("node-delete", { detail: { nodeId }, bubbles: true }));
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
      {/* ManyChat-style floating toolbar */}
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg p-1 opacity-0 group-hover/node:opacity-100 transition-opacity nopan nodrag"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button onClick={dispatchDuplicate} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors" title="Duplicar">
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={dispatchDelete} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-destructive/15 transition-colors" title="Apagar">
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

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
          {d.type === "condition" ? (
            <div className="space-y-2">
              {d.conditionField && d.conditionValue ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-red-500/10 text-[11px] font-semibold text-red-400 border border-red-500/20">
                    {d.conditionField}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {d.conditionOperator === "equals" ? "=" : d.conditionOperator === "starts_with" ? "começa com" : d.conditionOperator === "regex" ? "regex" : "contém"}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-foreground/5 text-[11px] font-medium text-foreground/70 border border-border/40">
                    "{d.conditionValue}"
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/60 italic px-1">Configurar condição...</p>
              )}
            </div>
          ) : d.type === "action" ? (() => {
            const actionLabels: Record<string, { label: string; color: string }> = {
              add_tag: { label: "Tag", color: "#f97316" },
              remove_tag: { label: "Remover Tag", color: "#ef4444" },
              add_to_list: { label: "Lista", color: "#3b82f6" },
              set_variable: { label: "Variável", color: "#8b5cf6" },
            };
            const info = actionLabels[d.actionType || "add_tag"] || actionLabels.add_tag;
            return (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold border"
                  style={{ backgroundColor: `${info.color}15`, color: info.color, borderColor: `${info.color}30` }}
                >
                  {info.label}
                </span>
                {d.actionValue ? (
                  <span className="text-[12px] text-foreground/70 font-medium truncate">{d.actionValue}</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/60 italic">Sem valor</span>
                )}
              </div>
            );
          })() : (
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
          )}
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
        d.type === "condition" ? (
          <>
            <Handle
              type="source"
              position={Position.Right}
              id="output-0"
              className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full"
              style={{ background: "#22c55e", top: "35%" }}
            />
            <span
              className="absolute text-[9px] font-medium whitespace-nowrap pointer-events-none"
              style={{ left: "calc(100% + 14px)", top: "35%", transform: "translateY(-50%)", color: "#22c55e" }}
            >
              Sim ✓
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="output-1"
              className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full"
              style={{ background: "#ef4444", top: "70%" }}
            />
            <span
              className="absolute text-[9px] font-medium whitespace-nowrap pointer-events-none"
              style={{ left: "calc(100% + 14px)", top: "70%", transform: "translateY(-50%)", color: "#ef4444" }}
            >
              Não ✗
            </span>
          </>
        ) : (
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
        )
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
