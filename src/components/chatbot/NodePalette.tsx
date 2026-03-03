import { icons } from "lucide-react";
import { nodeTypeConfig, type FlowNodeType } from "@/types/chatbot";

interface NodePaletteProps {
  onDragStart: (type: FlowNodeType) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  const categories = [
    {
      label: "Gatilhos",
      types: ["trigger"] as FlowNodeType[],
    },
    {
      label: "Mensagens",
      types: ["sendText", "sendAudio", "sendVideo", "sendImage"] as FlowNodeType[],
    },
    {
      label: "Lógica",
      types: ["condition", "randomizer", "waitDelay", "waitForReply"] as FlowNodeType[],
    },
    {
      label: "Ações",
      types: ["action"] as FlowNodeType[],
    },
  ];

  return (
    <div className="w-56 bg-card border-r border-border h-full overflow-y-auto">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Componentes
        </h3>
      </div>
      <div className="p-2 space-y-4">
        {categories.map((cat) => (
          <div key={cat.label}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
              {cat.label}
            </p>
            <div className="space-y-1">
              {cat.types.map((type) => {
                const config = nodeTypeConfig[type];
                return (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", type);
                      e.dataTransfer.effectAllowed = "move";
                      onDragStart(type);
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg cursor-grab hover:bg-secondary active:cursor-grabbing transition-colors group"
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ backgroundColor: config.color + "20", color: config.color }}
                    >
                      {(() => {
                        const LucideIcon = icons[config.icon as keyof typeof icons];
                        return LucideIcon ? <LucideIcon className="w-4 h-4" /> : null;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{config.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {config.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
