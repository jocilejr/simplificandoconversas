import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons, Clock } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, parseWhatsAppFormatting } from "@/types/chatbot";

interface StepNodeProps {
  data: Record<string, unknown>;
  selected?: boolean;
}

function renderBody(d: FlowNodeData) {
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
      return (d.audioUrl ? "🎵 Áudio carregado" : "Sem áudio") +
        (d.simulateRecording ? " · 🔴 Gravando" : "");
    case "sendVideo":
    case "sendImage":
      return d.mediaUrl ? "📎 Mídia carregada" : "Sem mídia";
    case "condition":
      return `Se ${d.conditionField || "campo"} ${d.conditionOperator || "contém"} "${d.conditionValue || "..."}"`;
    case "randomizer":
      return `${d.paths || 2} caminhos`;
    case "waitDelay":
      return null;
    case "waitForReply":
      return `Salvar em {{${d.replyVariable || "resposta"}}}${d.replyTimeout ? ` · ${d.replyTimeout}s` : ""}`;
    case "action":
      return d.actionType === "add_tag"
        ? `🏷️ Tag: ${d.actionValue || "..."}`
        : d.actionType === "remove_tag"
        ? `🏷️ Remover: ${d.actionValue || "..."}`
        : d.actionType === "add_to_list"
        ? `📋 Lista: ${d.actionValue || "..."}`
        : d.actionType === "set_variable"
        ? `📝 Var: ${d.actionValue || "..."}`
        : "Sem ação";
    default:
      return "";
  }
}

function StepNode({ data, selected }: StepNodeProps) {
  const d = data as FlowNodeData;
  const config = nodeTypeConfig[d.type];
  const LucideIcon = icons[config.icon as keyof typeof icons];
  const isTrigger = d.type === "trigger";
  const isDelay = d.type === "waitDelay";
  const hasMultipleOutputs = d.type === "condition" || d.type === "randomizer";
  const pathCount = d.type === "randomizer" ? (d.paths || 2) : 2;
  const isDockTarget = d.isDockTarget === true;

  // ─── Delay: compact pill ───
  if (isDelay) {
    return (
      <div className="relative">
        <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-left-1.5" />
        <div
          className={`flex items-center gap-2 rounded-full px-4 py-2 border transition-all ${
            isDockTarget
              ? "ring-2 ring-blue-500 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
              : selected
              ? "ring-2 ring-primary shadow-lg"
              : "shadow-sm hover:shadow-md"
          }`}
          style={{ borderColor: isDockTarget ? undefined : `${config.color}40`, backgroundColor: `${config.color}10` }}
        >
          <Clock className="w-3.5 h-3.5" style={{ color: config.color }} />
          <span className="text-xs font-semibold" style={{ color: config.color }}>{d.delaySeconds || 0}s</span>
          <span className="text-[10px] text-muted-foreground">{d.simulateTyping ? "digitando..." : "aguardando"}</span>
        </div>
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-right-1.5" />
      </div>
    );
  }

  // ─── Trigger: special green card ───
  if (isTrigger) {
    return (
      <div className="relative">
        <div
          className={`w-[240px] rounded-2xl overflow-hidden transition-all duration-200 ${
            selected ? "shadow-xl ring-2 ring-primary/30" : "shadow-md hover:shadow-lg"
          }`}
          style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)` }}
        >
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              {LucideIcon && <LucideIcon className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-[13px] font-bold text-white tracking-wide">{d.label || "Gatilho"}</span>
          </div>
          <div className="px-4 py-2.5 bg-black/10 backdrop-blur-sm">
            <p className="text-[12px] text-white/80 font-medium">{renderBody(d)}</p>
          </div>
        </div>
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-card !bg-white !-right-1.5" />
      </div>
    );
  }

  // ─── Regular step node ───
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-left-1.5" />

      <div
        className={`w-[260px] rounded-2xl overflow-hidden transition-all duration-200 bg-card border ${
          isDockTarget
            ? "ring-2 ring-blue-500 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            : selected
            ? "shadow-xl ring-2 ring-primary/25 border-primary/40"
            : "shadow-md hover:shadow-lg border-border/50"
        }`}
      >
        <div className="h-[3px] w-full" style={{ backgroundColor: config.color }} />
        <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ backgroundColor: `${config.color}14` }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${config.color}22`, color: config.color }}>
            {LucideIcon && <LucideIcon className="w-3.5 h-3.5" />}
          </div>
          <span className="text-[13px] font-bold text-foreground truncate">{d.label || config.label}</span>
        </div>
        <div className="px-3.5 py-3 text-xs text-muted-foreground leading-relaxed">{renderBody(d)}</div>

        {/* Dock indicator */}
        {isDockTarget && (
          <div className="px-3 py-1.5 bg-blue-500/10 border-t border-blue-500/30">
            <p className="text-[10px] text-blue-500 text-center font-medium animate-pulse">Solte para acoplar</p>
          </div>
        )}
      </div>

      {hasMultipleOutputs ? (
        Array.from({ length: pathCount }).map((_, i) => (
          <Handle key={`output-${i}`} type="source" position={Position.Right} id={`output-${i}`} className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-right-1.5" style={{ top: `${((i + 1) / (pathCount + 1)) * 100}%` }} />
        ))
      ) : (
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground !-right-1.5" />
      )}
    </div>
  );
}

export default memo(StepNode);
