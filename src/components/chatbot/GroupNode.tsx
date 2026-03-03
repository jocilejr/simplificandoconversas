import { memo } from "react";

function GroupNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const label = (data.label as string) || "Grupo";

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
        📦 {label}
      </div>
    </div>
  );
}

export default memo(GroupNode);
