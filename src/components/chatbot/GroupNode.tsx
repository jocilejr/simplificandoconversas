import { memo, useState, useCallback, useRef } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons, CheckCircle2, Plus, GripVertical } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, type FlowStepData } from "@/types/chatbot";

interface GroupNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function StepRow({
  step,
  index,
  totalSteps,
  dragIndex,
  dropIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  step: FlowStepData;
  index: number;
  totalSteps: number;
  dragIndex: number | null;
  dropIndex: number | null;
  onDragStart: (i: number) => void;
  onDragOver: (i: number) => void;
  onDragEnd: () => void;
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

  const isDragging = dragIndex === index;
  const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;

  return (
    <div
      data-step-id={step.id}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOver(index);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
      className={`flex items-center gap-2 px-2 py-2 mx-2 mb-1 rounded-lg transition-all cursor-grab active:cursor-grabbing ${
        isDragging
          ? "opacity-40 scale-95"
          : isDropTarget
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "bg-secondary/50 hover:bg-secondary"
      }`}
    >
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
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
    </div>
  );
}

function GroupNode({ id, data, selected }: GroupNodeProps) {
  const d = data as FlowNodeData;
  const steps = (d.steps || []) as FlowStepData[];
  const isDockTarget = d.isDockTarget === true;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const firstStep = steps[0];
  const headerConfig = firstStep ? nodeTypeConfig[firstStep.data.type] : null;
  const accentColor = headerConfig?.color || "hsl(142, 70%, 45%)";

  const handleDragStart = useCallback((i: number) => {
    setDragIndex(i);
  }, []);

  const handleDragOver = useCallback((i: number) => {
    setDropIndex(i);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      // Dispatch a custom event that FlowEditor can listen to
      const event = new CustomEvent("group-reorder-step", {
        detail: { nodeId: id, fromIndex: dragIndex, toIndex: dropIndex },
        bubbles: true,
      });
      document.dispatchEvent(event);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, id]);

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
          <CheckCircle2 className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
        </div>

        <div className="py-2">
          {steps.length > 0 ? (
            steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                index={i}
                totalSteps={steps.length}
                dragIndex={dragIndex}
                dropIndex={dropIndex}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
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
