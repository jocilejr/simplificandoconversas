import { memo, useState, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons, CheckCircle2, Plus } from "lucide-react";
import { nodeTypeConfig, type FlowNodeData, type FlowNodeType, type FlowStepData } from "@/types/chatbot";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface GroupNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function StepRow({
  step,
  index,
  nodeId,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  step: FlowStepData;
  index: number;
  nodeId: string;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: (i: number) => void;
  onDragEnter: (i: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
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
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/step-id", step.id);
        e.dataTransfer.setData("application/source-node-id", nodeId);
        const el = e.currentTarget;
        e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
        onDragStart(index);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragEnd={(e) => onDragEnd(e)}
      className={`flex items-center gap-3 px-3 py-2.5 mx-2 mb-1 rounded-lg transition-all cursor-grab active:cursor-grabbing nopan nodrag ${
        isDragging
          ? "opacity-30 scale-95"
          : isDropTarget
          ? "bg-primary/12 ring-1 ring-primary/30 scale-[1.02]"
          : "bg-secondary/50 hover:bg-secondary"
      }`}
    >
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

const addableTypes: FlowNodeType[] = ["sendText", "sendAudio", "sendVideo", "sendImage", "condition", "waitDelay", "waitForReply", "action"];

function GroupNode({ id, data, selected }: GroupNodeProps) {
  const d = data as FlowNodeData;
  const steps = (d.steps || []) as FlowStepData[];
  const isDockTarget = d.isDockTarget === true;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const firstStep = steps[0];
  const headerConfig = firstStep ? nodeTypeConfig[firstStep.data.type] : null;
  const accentColor = headerConfig?.color || "hsl(142, 70%, 45%)";

  const handleDragStart = useCallback((i: number) => {
    setDragIndex(i);
  }, []);

  const handleDragEnter = useCallback((i: number) => {
    setOverIndex(i);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    // Check if dropped outside the group bounds
    const groupEl = document.querySelector(`[data-id="${id}"]`);
    if (groupEl) {
      const rect = groupEl.getBoundingClientRect();
      const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
      if (outside && dragIndex !== null) {
        const step = steps[dragIndex];
        if (step) {
          const event = new CustomEvent("group-extract-step", {
            detail: { nodeId: id, stepId: step.id, clientX: e.clientX, clientY: e.clientY },
            bubbles: true,
          });
          document.dispatchEvent(event);
          setDragIndex(null);
          setOverIndex(null);
          return;
        }
      }
    }

    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const event = new CustomEvent("group-reorder-step", {
        detail: { nodeId: id, fromIndex: dragIndex, toIndex: overIndex },
        bubbles: true,
      });
      document.dispatchEvent(event);
    }
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, overIndex, id, steps]);

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
        {/* Header — drag handle for moving the whole node */}
        <div className="group-drag-handle flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50 cursor-grab active:cursor-grabbing">
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

        <div
          className="py-2 nopan nodrag"
          onDragOver={(e) => {
            // Accept drops from other groups
            if (e.dataTransfer.types.includes("application/step-id")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(e) => {
            const stepId = e.dataTransfer.getData("application/step-id");
            const sourceNodeId = e.dataTransfer.getData("application/source-node-id");
            if (stepId && sourceNodeId && sourceNodeId !== id) {
              e.preventDefault();
              e.stopPropagation();
              const event = new CustomEvent("group-receive-step", {
                detail: { targetNodeId: id, sourceNodeId, stepId },
                bubbles: true,
              });
              document.dispatchEvent(event);
            }
          }}
        >
          {steps.length > 0 ? (
            steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                index={i}
                nodeId={id}
                isDragging={dragIndex === i}
                isDropTarget={overIndex === i && dragIndex !== null && dragIndex !== i}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
              Arraste nós para acoplar
            </div>
          )}
        </div>

        <div className="px-3 pb-2.5 nopan nodrag">
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Adicionar ação</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1.5" side="bottom" align="center">
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {addableTypes.map((type) => {
                  const config = nodeTypeConfig[type];
                  const LucideIcon = icons[config.icon as keyof typeof icons];
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        const event = new CustomEvent("group-add-step", {
                          detail: { nodeId: id, stepType: type },
                          bubbles: true,
                        });
                        document.dispatchEvent(event);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-secondary transition-colors text-left"
                    >
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${config.color}18`, color: config.color }}
                      >
                        {LucideIcon && <LucideIcon className="w-3 h-3" />}
                      </div>
                      <span className="text-[12px] font-medium text-foreground">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
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
