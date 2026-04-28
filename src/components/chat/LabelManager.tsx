import { useState } from "react";
import { useLabels, useConversationLabels, useAssignLabel, useRemoveLabel, useCreateLabel } from "@/hooks/useLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Plus, X, Tag as TagIcon } from "lucide-react";

const PALETTE = ["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1"];

export function LabelManager({ conversationId }: { conversationId: string }) {
  const { data: allLabels = [] } = useLabels();
  const { data: assigned = [] } = useConversationLabels(conversationId);
  const assignMut = useAssignLabel();
  const removeMut = useRemoveLabel();
  const createMut = useCreateLabel();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const assignedIds = new Set(assigned.map((a) => a.label_id));
  const available = allLabels.filter((l) => !assignedIds.has(l.id));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res: any = await createMut.mutateAsync({ name: newName.trim(), color: newColor });
    if (res?.id) {
      await assignMut.mutateAsync({ conversationId, labelId: res.id });
    }
    setNewName("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
          <TagIcon className="h-3 w-3" /> Etiquetas
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            {available.length > 0 && (
              <div className="space-y-1 mb-3">
                <span className="text-[10px] text-muted-foreground">Atribuir existente:</span>
                <div className="flex flex-wrap gap-1">
                  {available.map((l) => (
                    <Badge
                      key={l.id}
                      className="cursor-pointer text-[10px]"
                      style={{ backgroundColor: l.color, color: "#fff" }}
                      onClick={() => assignMut.mutate({ conversationId, labelId: l.id })}
                    >
                      {l.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2 border-t border-border pt-2">
              <span className="text-[10px] text-muted-foreground">Criar nova:</span>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome"
                className="h-7 text-xs"
              />
              <div className="flex gap-1 flex-wrap">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-5 w-5 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button size="sm" className="h-7 w-full text-xs" onClick={handleCreate} disabled={!newName.trim()}>
                Criar e atribuir
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {assigned.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhuma etiqueta</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {assigned.map((a) => (
            <Badge
              key={a.id}
              className="text-[10px] gap-1 pr-1"
              style={{ backgroundColor: a.labels?.color || "#3b82f6", color: "#fff" }}
            >
              {a.labels?.name}
              <button
                onClick={() => removeMut.mutate({ linkId: a.id, conversationId })}
                className="hover:bg-black/20 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
