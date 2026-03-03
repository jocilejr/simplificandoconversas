import { memo, type FC } from "react";
import { type NodeProps } from "@xyflow/react";

interface GroupNodeData {
  label: string;
  [key: string]: unknown;
}

const GroupNode: FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as GroupNodeData;

  return (
    <div
      className={`
        rounded-xl border-2 border-dashed bg-secondary/30 backdrop-blur-sm min-w-[280px] min-h-[120px]
        transition-all
        ${selected ? "border-primary shadow-lg" : "border-border hover:border-muted-foreground"}
      `}
      style={{ padding: 8 }}
    >
      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        📦 {nodeData.label || "Grupo"}
      </div>
    </div>
  );
};

export default memo(GroupNode);
