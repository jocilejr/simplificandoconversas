import { useState } from "react";
import { FolderOpen, Plus, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface QuickRepliesSidebarProps {
  categories: string[];
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  counts: Record<string, number>;
  total: number;
}

export function QuickRepliesSidebar({
  categories,
  activeCategory,
  onSelect,
  onRenameCategory,
  counts,
  total,
}: QuickRepliesSidebarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renamingCat, setRenamingCat] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const handleCreate = () => {
    if (!newCatName.trim()) return;
    // Creating a category = just selecting it; it'll exist once a reply is created with it
    onSelect(newCatName.trim());
    setNewCatName("");
    setCreateOpen(false);
  };

  const handleRename = () => {
    if (!renameValue.trim() || renameValue.trim() === renamingCat) return;
    onRenameCategory(renamingCat, renameValue.trim());
    setRenameOpen(false);
  };

  return (
    <div className="w-56 shrink-0 border-r border-border/60 pr-3 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categorias</span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* All */}
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors",
          activeCategory === null
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted/50"
        )}
      >
        <FolderOpen className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Todas</span>
        <span className="text-[10px] opacity-60">{total}</span>
      </button>

      {categories.map((cat) => (
        <div key={cat} className="group flex items-center">
          <button
            onClick={() => onSelect(cat)}
            className={cn(
              "flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors",
              activeCategory === cat
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="flex-1 text-left truncate">{cat}</span>
            <span className="text-[10px] opacity-60">{counts[cat] || 0}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setRenamingCat(cat);
                  setRenameValue(cat);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {/* Create Category Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <Input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Nome da categoria"
            className="h-8 text-sm"
          />
          <DialogFooter>
            <Button size="sm" onClick={handleCreate} disabled={!newCatName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Renomear Categoria</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Novo nome"
            className="h-8 text-sm"
          />
          <DialogFooter>
            <Button size="sm" onClick={handleRename} disabled={!renameValue.trim()}>
              Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
