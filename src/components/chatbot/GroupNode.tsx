import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import { icons, CheckCircle2, Plus, Play, Pause, Mic, Clock, Link, Trash2, Copy, GripVertical, FileText } from "lucide-react";

/* ---- Mini player customizado para dentro do React Flow ---- */
function AudioPreviewPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = "metadata";
    audioRef.current = audio;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); } else { audio.play(); }
    setIsPlaying(!isPlaying);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const [bars] = useState(() => Array.from({ length: 28 }, () => Math.random() * 0.7 + 0.3));

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 nopan nodrag nowheel"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={toggle}
        className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 hover:bg-primary/25 transition-colors"
      >
        {isPlaying ? (
          <Pause className="w-2.5 h-2.5 text-primary" />
        ) : (
          <Play className="w-2.5 h-2.5 text-primary fill-primary ml-px" />
        )}
      </button>
      <div
        className="flex-1 flex items-center gap-px h-[14px] cursor-pointer"
        onClick={seek}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {bars.map((h, i) => {
          const barPos = (i / bars.length) * 100;
          const isPlayed = barPos < progress;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-colors"
              style={{
                height: `${h * 14}px`,
                backgroundColor: isPlayed ? "hsl(var(--primary) / 0.7)" : "hsl(var(--muted-foreground) / 0.2)",
              }}
            />
          );
        })}
      </div>
      <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0 min-w-[28px] text-right">
        {fmt(isPlaying ? currentTime : duration)}
      </span>
    </div>
  );
}
import { nodeTypeConfig, parseWhatsAppFormatting, type FlowNodeData, type FlowNodeType, type FlowStepData } from "@/types/chatbot";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface GroupNodeProps {
  id: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

function StepDuplicateButton({ nodeId, stepId }: { nodeId: string; stepId: string }) {
  return (
    <button
      className="absolute -top-2 -right-2 z-50 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover/step:opacity-100 transition-opacity shadow-md hover:scale-110 nopan nodrag"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("group-duplicate-step", { detail: { nodeId, stepId }, bubbles: true }));
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Copy className="w-3 h-3" />
    </button>
  );
}

function DragHandle({
  index,
  stepId,
  nodeId,
  onDragStart,
  onDragEnd,
  containerRef,
}: {
  index: number;
  stepId: string;
  nodeId: string;
  onDragStart: (i: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/step-id", stepId);
        e.dataTransfer.setData("application/source-node-id", nodeId);
        // Use parent container as drag image
        if (containerRef.current) {
          e.dataTransfer.setDragImage(containerRef.current, containerRef.current.offsetWidth / 2, containerRef.current.offsetHeight / 2);
        }
        onDragStart(index);
      }}
      onDragEnd={onDragEnd}
      className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/step:opacity-100 transition-opacity nopan nodrag"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground" />
    </div>
  );
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
  const containerRef = useRef<HTMLDivElement>(null!);
  const d = step.data;
  const config = nodeTypeConfig[d.type];
  if (!config) return null;

  const LucideIcon = icons[config.icon as keyof typeof icons];

  // Build preview content based on type
  const renderPreview = () => {
    switch (d.type) {
      case "sendText": {
        if (!d.textContent) return null;
        const html = parseWhatsAppFormatting(d.textContent);
        return (
          <div className="mx-1 mt-1 px-2.5 py-2 rounded-lg bg-muted/60 border border-border/30">
            <p
              className="text-[11px] text-foreground/80 whitespace-pre-wrap line-clamp-3 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        );
      }
      case "sendImage": {
        if (!d.mediaUrl) return null;
        return (
          <div className="mx-1 mt-1 space-y-1.5">
            <div className="w-full rounded-lg bg-black/20 border border-border/30 overflow-hidden flex items-center justify-center">
              <img
                src={d.mediaUrl}
                alt="Preview"
                className="w-full max-h-[140px] object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            {d.caption && (
              <p className="text-[11px] text-muted-foreground truncate px-1">{d.caption}</p>
            )}
          </div>
        );
      }
      case "sendVideo": {
        if (!d.mediaUrl) return null;
        return (
          <div className="mx-1 mt-1 space-y-1">
            <div className="relative w-full h-[60px] rounded-lg bg-muted/80 border border-border/30 flex items-center justify-center overflow-hidden">
              <video
                src={d.mediaUrl}
                className="w-full h-full object-cover absolute inset-0"
                muted
                preload="metadata"
              />
              <div className="relative z-10 w-8 h-8 rounded-full bg-foreground/70 flex items-center justify-center">
                <Play className="w-4 h-4 text-background fill-background" />
              </div>
            </div>
            {d.caption && (
              <p className="text-[10px] text-muted-foreground truncate px-1">{d.caption}</p>
            )}
          </div>
        );
      }
      case "sendAudio": {
        return (
          <div className="mx-1 mt-1 rounded-lg bg-muted/60 border border-border/30">
            {d.audioUrl ? (
              <AudioPreviewPlayer src={d.audioUrl as string} />
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-2.5">
                <Mic className="w-4 h-4 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Nenhum áudio</span>
              </div>
            )}
            {d.simulateRecording && (
              <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-red-500/8 border-t border-red-500/15">
                <Mic className="w-3 h-3 text-red-400" />
                <span className="text-[9px] font-semibold text-red-400 tracking-wider uppercase">Gravando</span>
              </div>
            )}
          </div>
        );
      }
      case "waitDelay":
        return null;
      case "waitForClick":
        return null;
      default:
        return null;
    }
  };

  // For waitDelay, render a compact centered pill
  if (d.type === "waitDelay") {
    return (
      <div
        ref={containerRef}
        data-step-id={step.id}
        onDragEnter={(e) => { e.preventDefault(); onDragEnter(index); }}
        onDragOver={(e) => { e.preventDefault(); }}
        className={`relative flex items-center my-2 mx-3 cursor-pointer nopan nodrag ${
          isDragging ? "opacity-30 scale-95" : isDropTarget ? "scale-[1.02]" : ""
        }`}
      >
        <DragHandle index={index} stepId={step.id} nodeId={nodeId} onDragStart={onDragStart} onDragEnd={onDragEnd} containerRef={containerRef} />
        <div className="flex-1 h-px bg-border/60" />
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-muted-foreground transition-colors ${
          isDropTarget ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50 hover:bg-muted/70"
        }`}>
          <span className="text-[11px] font-semibold tabular-nums">
            {d.delayRandomMode ? `${d.delayMinSeconds || 0}s–${d.delayMaxSeconds || 0}s` : `${d.delaySeconds || 0}s`}
            {d.delayPresenceType === "recording" ? " · gravando..." : d.delayPresenceType === "composing" ? " · digitando..." : ""}
          </span>
        </div>
        <div className="flex-1 h-px bg-border/60" />
      </div>
    );
  }

  // For waitForClick, render a styled card with link icon
  if (d.type === "waitForClick") {
    const displayUrl = d.clickUrl
      ? (d.clickUrl.length > 35 ? d.clickUrl.substring(0, 35) + "..." : d.clickUrl)
      : "URL não definida";
    return (
      <div
        ref={containerRef}
        data-step-id={step.id}
        onDragEnter={(e) => { e.preventDefault(); onDragEnter(index); }}
        onDragOver={(e) => { e.preventDefault(); }}
        className={`mx-1 mb-1 rounded-xl overflow-hidden transition-all cursor-pointer nopan nodrag ${
          isDragging ? "opacity-30 scale-95"
            : isDropTarget ? "ring-1 ring-primary/30 scale-[1.02]"
            : ""
        }`}
      >
        {/* Header bar */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-sky-500/10 border-b border-sky-500/20">
          <DragHandle index={index} stepId={step.id} nodeId={nodeId} onDragStart={onDragStart} onDragEnd={onDragEnd} containerRef={containerRef} />
          <div className="w-6 h-6 rounded-md bg-sky-500/20 flex items-center justify-center flex-shrink-0">
            <Link className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <span className="text-[11px] font-semibold text-sky-400">Aguardar Clique</span>
        </div>
        {/* URL display */}
        <div className="px-3 py-2.5 bg-muted/30">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background/60 border border-border/30">
            <Link className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
            <span className={`text-[11px] font-mono truncate ${d.clickUrl ? "text-sky-400/80" : "text-muted-foreground/50 italic"}`}>
              {displayUrl}
            </span>
          </div>
        </div>
        {/* Timeout indicator */}
        {(d.clickTimeout || 0) > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/5 border-t border-orange-500/10">
            <Clock className="w-3 h-3 text-orange-500" />
            <span className="text-[10px] text-orange-500 font-medium">
              Timeout: {d.clickTimeout}{d.clickTimeoutUnit === "minutes" ? "min" : d.clickTimeoutUnit === "hours" ? "h" : "s"}
            </span>
          </div>
        )}
      </div>
    );
  }


  if (d.type === "sendText" && d.textContent) {
    const html = parseWhatsAppFormatting(d.textContent);
    return (
      <div
        ref={containerRef}
        data-step-id={step.id}
        onDragEnter={(e) => { e.preventDefault(); onDragEnter(index); }}
        onDragOver={(e) => { e.preventDefault(); }}
        className={`mx-1 mb-1 px-3.5 py-3 rounded-xl transition-all cursor-pointer nopan nodrag flex items-start gap-1.5 ${
          isDragging ? "opacity-30 scale-95"
            : isDropTarget ? "bg-primary/12 ring-1 ring-primary/30 scale-[1.02]"
            : "bg-secondary/50 hover:bg-secondary/70"
        }`}
      >
        <div className="pt-0.5">
          <DragHandle index={index} stepId={step.id} nodeId={nodeId} onDragStart={onDragStart} onDragEnd={onDragEnd} containerRef={containerRef} />
        </div>
        <p
          className="text-[13px] text-foreground/85 whitespace-pre-wrap line-clamp-8 leading-relaxed flex-1 min-w-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // Compact description for remaining types
  let desc = config.description;
  if (d.type === "action") {
    desc = d.actionValue || config.description;
  } else if (d.type === "condition") {
    desc = `${d.conditionField || "campo"} ${d.conditionOperator || "contém"} "${d.conditionValue || "..."}"`;
  } else if (d.type === "waitForReply") {
    desc = `Salvar em {{${d.replyVariable || "resposta"}}}`;
  }

  const hasRichPreview = ["sendText", "sendImage", "sendVideo", "sendAudio"].includes(d.type);

  return (
    <div
      ref={containerRef}
      data-step-id={step.id}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter(index); }}
      onDragOver={(e) => { e.preventDefault(); }}
      className={`px-2 pb-1.5 pt-1 mx-1 mb-1 rounded-lg transition-all cursor-pointer nopan nodrag nowheel ${
        isDragging
          ? "opacity-30 scale-95"
          : isDropTarget
          ? "bg-primary/12 ring-1 ring-primary/30 scale-[1.02]"
          : "bg-secondary/40 hover:bg-secondary/60"
      }`}
      onMouseDown={d.type === "sendAudio" ? (e) => e.stopPropagation() : undefined}
      onPointerDown={d.type === "sendAudio" ? (e) => e.stopPropagation() : undefined}
      onTouchStart={d.type === "sendAudio" ? (e) => e.stopPropagation() : undefined}
    >
      {/* Header row: grip + icon + label */}
      <div className="flex items-center gap-2.5 py-1.5 px-1">
        <DragHandle index={index} stepId={step.id} nodeId={nodeId} onDragStart={onDragStart} onDragEnd={onDragEnd} containerRef={containerRef} />
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${config.color}18`, color: config.color }}
        >
          {LucideIcon && <LucideIcon className="w-3 h-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-foreground truncate">{d.label || config.label}</p>
          {!hasRichPreview && (
            <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
          )}
        </div>
      </div>

      {/* Rich preview */}
      {renderPreview()}

      {/* Timeout indicator for waitForReply */}
      {d.type === "waitForReply" && (d.replyTimeout || 0) > 0 && (
        <div className="flex items-center gap-1.5 px-1 mt-1">
          <Clock className="w-3 h-3 text-orange-500" />
          <span className="text-[10px] text-orange-500 font-medium">
            Timeout: {d.replyTimeout}{d.replyTimeoutUnit === "minutes" ? "min" : d.replyTimeoutUnit === "hours" ? "h" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}

const allAddableTypes: FlowNodeType[] = ["sendText", "sendAudio", "sendVideo", "sendImage", "condition", "waitDelay", "waitForReply", "waitForClick", "action"];
const finalizerTypes: FlowNodeType[] = ["waitForReply", "waitForClick"];

function GroupNode({ id, data, selected }: GroupNodeProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const d = data as FlowNodeData;
  const steps = (d.steps || []) as FlowStepData[];
  const hasFinalizerStep = steps.some((s) => finalizerTypes.includes(s.data.type as FlowNodeType));
  const addableTypes = hasFinalizerStep
    ? allAddableTypes.filter((t) => !finalizerTypes.includes(t))
    : allAddableTypes;
  const isDockTarget = d.isDockTarget === true;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const firstStep = steps[0];
  const headerConfig = firstStep ? nodeTypeConfig[firstStep.data.type] : null;
  const accentColor = headerConfig?.color || "hsl(142, 70%, 45%)";

  const finalizerStep = steps.find((s) => finalizerTypes.includes(s.data.type as FlowNodeType));
  const timeoutLabel = finalizerStep?.data.type === "waitForReply" ? "Se não respondeu" : "Se não clicou";

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
    <div className="relative group/card" style={{ background: "transparent" }}>
      {/* ManyChat-style floating toolbar */}
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg p-1 opacity-0 group-hover/card:opacity-100 transition-opacity nopan nodrag"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors"
          title="Duplicar"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            document.dispatchEvent(new CustomEvent("node-duplicate", { detail: { nodeId: id }, bubbles: true }));
          }}
        >
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-destructive/15 transition-colors"
          title="Apagar"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            document.dispatchEvent(new CustomEvent("group-delete", { detail: { nodeId: id }, bubbles: true }));
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full group-handle-target"
        style={{ background: accentColor }}
      />

      <div
        className={`${hasFinalizerStep ? "w-[320px]" : "w-[280px]"} rounded-xl overflow-visible transition-all duration-200 bg-card border ${
          isDockTarget
            ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
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
              <div key={step.id} className="relative group/step">
                <StepDuplicateButton nodeId={id} stepId={step.id} />
                <StepRow
                  step={step}
                  index={i}
                  nodeId={id}
                  isDragging={dragIndex === i}
                  isDropTarget={overIndex === i && dragIndex !== null && dragIndex !== i}
                  onDragStart={handleDragStart}
                  onDragEnter={handleDragEnter}
                  onDragEnd={handleDragEnd}
                />
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
              Arraste nós para acoplar
            </div>
          )}
        </div>

        {!hasFinalizerStep && (
          <div className="px-3 pb-2.5 nopan nodrag">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
                          setPopoverOpen(false);
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
        )}

        {hasFinalizerStep && (
          <div className="border-t border-border/40">
            <div className="relative flex items-center justify-end pr-5 h-6">
              <span className="text-[10px] font-medium text-emerald-500">Continuou ✓</span>
              <Handle
                type="source"
                position={Position.Right}
                id="output-0"
                className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full group-handle-output-0"
                style={{ background: "#10b981" }}
              />
            </div>
            <div className="relative flex items-center justify-end pr-5 h-6">
              <span className="text-[10px] font-medium text-orange-500">{timeoutLabel} ⏱</span>
              <Handle
                type="source"
                position={Position.Right}
                id="output-1"
                className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full group-handle-output-1"
                style={{ background: "#f97316" }}
              />
            </div>
          </div>
        )}
        {isDockTarget && (
          <div className="px-3 py-2 bg-blue-500/10 border-t border-blue-500/30">
            <p className="text-[11px] text-blue-500 text-center font-medium animate-pulse">
              Solte para acoplar
            </p>
          </div>
        )}
      </div>

      {hasFinalizerStep ? null : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3.5 !h-3.5 !border-2 !border-card !rounded-full group-handle-source"
          style={{ background: accentColor }}
        />
      )}
    </div>
  );
}

export default memo(GroupNode);
