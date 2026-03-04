import { memo, useState, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons, CheckCircle2, Plus, MoveVertical } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, type FlowStepData } from "@/types/chatbot";

interface GroupNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function StepRow({
  step,
  index,
  isPickedUp,
  isSwapTarget,
  onClickStep,
}: {
  step: FlowStepData;
  index: number;
  isPickedUp: boolean;
  isSwapTarget: boolean;
  onClickStep: (index: number, e: React.MouseEvent) => void;
}) {
  const d = step.data;
  const config = nodeTypeConfig[d.type];
  if (!config) return null;

  const LucideIcon = icons[config.icon as keyof typeof icons];

  let desc = config.description;
  if (d.type === "sendText" && d.textContent) {
    desc = d.textContent.length > 40 ? d.textContent.slice(0, 40) + "…" : d.textContent;
  } else if (d.type === "waitDelay") {
    desc = `Aguardar ${d.delaySeconds || 0}s`;
  } else if (d.type === "action") {
    desc = d.actionValue || config.description;
  } else if (d.type === "condition") {
    desc = `${d.conditionField || "campo"} ${d.conditionOperator || "contém"} "${d.conditionValue || "..."}"`;
  } else if (d.type === "waitForReply") {
    desc = `Salvar em {{${d.replyVariable || "resposta"}}}`;
  }

  return (
    <div
      data-step-id={step.id}
      onClick={(e) => {
        e.stopPropagation();
        onClickStep(index, e);
      }}
      className={`flex items-center gap-2 px-2 py-2 mx-2 mb-1 rounded-lg transition-all cursor-pointer select-none ${
        isPickedUp
          ? "bg-primary/15 ring-2 ring-primary/40 scale-[1.02]"
          : isSwapTarget
          ? "bg-primary/8 ring-1 ring-primary/20"
          : "bg-secondary/50 hover:bg-secondary"
      }`}
    >
      <MoveVertical className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isPickedUp ? "text-primary" : "text-muted-foreground/40"}`} />
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}18`, color: config.color }}
      >
        {LucideIcon && <LucideIcon className="w-3.5 h-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-foreground truncate">{d.label || config.label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
      </div>
      {isPickedUp && (
        <span className="text-[9px] text-primary font-medium flex-shrink-0">Mover</span>
      )}
    </div>
  );
}

function GroupNode({ id, data, selected }: GroupNodeProps) {
  const d = data as FlowNodeData;
  const steps = (d.steps || []) as FlowStepData[];
  const isDockTarget = d.isDockTarget === true;
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  const firstStep = steps[0];
  const headerConfig = firstStep ? nodeTypeConfig[firstStep.data.type] : null;
  const accentColor = headerConfig?.color || "hsl(142, 70%, 45%)";

  const handleClickStep = useCallback(
    (index: number, e: React.MouseEvent) => {
      if (pickedIndex === null) {
        // First click: pick up
        setPickedIndex(index);
      } else if (pickedIndex === index) {
        // Click same: cancel
        setPickedIndex(null);
      } else {
        // Click different: move to position
        const event = new CustomEvent("group-reorder-step", {
          detail: { nodeId: id, fromIndex: pickedIndex, toIndex: index },
          bubbles: true,
        });
        document.dispatchEvent(event);
        setPickedIndex(null);
      }
    },
    [pickedIndex, id]
  );

  return (
    <div className="relative" style={{ background: "transparent" }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full group-handle-target"
        style={{ background: accentColor }}
      />

      <div
        className={`w-[280px] rounded-xl overflow-hidden transition-all duration-200 bg-card border ${
          isDockTarget
            ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            : selected
            ? "border-primary/40 shadow-xl"
            : "border-border shadow-md hover:shadow-lg"
        }`}
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-[13px] font-semibold text-foreground flex-1 truncate">
            {d.label || "Grupo"}
          </p>
          {pickedIndex !== null && (
            <span className="text-[9px] text-primary font-medium animate-pulse">Selecione destino</span>
          )}
        </div>

        <div className="py-2">
          {steps.length > 0 ? (
            steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                index={i}
                isPickedUp={pickedIndex === i}
                isSwapTarget={pickedIndex !== null && pickedIndex !== i}
                onClickStep={handleClickStep}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
              Arraste nós para acoplar
            </div>
          )}
        </div>

        <div className="px-3 pb-2.5">
          <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors">
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Adicionar ação</span>
          </button>
        </div>

        {isDockTarget && (
          <div className="px-3 py-2 bg-blue-500/10 border-t border-blue-500/30">
            <p className="text-[11px] text-blue-500 text-center font-medium animate-pulse">
              Solte para acoplar
            </p>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full group-handle-source"
        style={{ background: accentColor }}
      />
    </div>
  );
}

export default memo(GroupNode);
