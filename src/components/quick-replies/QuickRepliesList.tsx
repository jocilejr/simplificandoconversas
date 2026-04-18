import { useState } from "react";
import { Plus, Search, MessageSquareText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickReplyCard } from "./QuickReplyCard";
import type { QuickReply } from "@/hooks/useQuickReplies";

interface QuickRepliesListProps {
  items: QuickReply[];
  categories: string[];
  activeCategory: string | null;
  onUpdate: (data: { id: string; title: string; content: string; category: string }) => void;
  onCreate: (data: { title: string; content: string; category: string }) => Promise<void>;
  onDelete: (id: string) => void;
}

export function QuickRepliesList({
  items,
  categories,
  activeCategory,
  onUpdate,
  onCreate,
  onDelete,
}: QuickRepliesListProps) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState(activeCategory || categories[0] || "");
  const [creating, setCreating] = useState(false);

  const filtered = items.filter(
    (i) =>
      (!activeCategory || i.category === activeCategory) &&
      (!search ||
        i.title.toLowerCase().includes(search.toLowerCase()) ||
        i.content.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim() || !newCategory) return;
    setCreating(true);
    try {
      await onCreate({ title: newTitle.trim(), content: newContent.trim(), category: newCategory });
      setNewTitle("");
      setNewContent("");
      setNewCategory(activeCategory || categories[0] || "");
      setDialogOpen(false);
    } catch {
      // toast already shown by parent
    } finally {
      setCreating(false);
    }
  };

  const noCategories = categories.length === 0;

  const label = activeCategory || "Todas";

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{label}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setDialogOpen(true)}
            disabled={noCategories}
            title={noCategories ? "Crie uma categoria primeiro" : undefined}
          >
            <Plus className="h-3.5 w-3.5" /> Nova Resposta
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 py-20">
          <MessageSquareText className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhuma resposta rápida encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((item) => (
            <QuickReplyCard
              key={item.id}
              id={item.id}
              title={item.title}
              content={item.content}
              category={item.category}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Resposta Rápida</DialogTitle>
            <DialogDescription>Preencha os campos abaixo para criar uma nova resposta rápida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Saudação inicial"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Conteúdo da resposta..."
                className="min-h-[100px] text-sm resize-none mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim() || !newContent.trim() || creating}>
              {creating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Criando...</> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
