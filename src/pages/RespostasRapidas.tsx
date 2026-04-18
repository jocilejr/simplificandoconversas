import { useState, useMemo } from "react";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { useQuickReplyCategories } from "@/hooks/useQuickReplyCategories";
import { QuickRepliesSidebar } from "@/components/quick-replies/QuickRepliesSidebar";
import { QuickRepliesList } from "@/components/quick-replies/QuickRepliesList";
import { toast } from "sonner";

export default function RespostasRapidas() {
  const { data = [], create, update, remove } = useQuickReplies();
  const { data: categoryRows = [], create: createCat, rename: renameCat, remove: removeCat } = useQuickReplyCategories();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => categoryRows.map((c) => c.name), [categoryRows]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((d) => {
      map[d.category] = (map[d.category] || 0) + 1;
    });
    return map;
  }, [data]);

  const formatError = (err: unknown) => {
    const e = err as any;
    const parts: string[] = [];
    if (e?.message) parts.push(e.message);
    if (e?.details) parts.push(e.details);
    if (e?.hint) parts.push(e.hint);
    return parts.length > 0 ? parts.join(" — ") : "Erro desconhecido";
  };

  const handleCreate = (d: { title: string; content: string; category: string }) => {
    return new Promise<void>((resolve, reject) => {
      create.mutate(d, {
        onSuccess: () => { toast.success("Resposta criada!"); resolve(); },
        onError: (err) => { toast.error(formatError(err)); reject(err); },
      });
    });
  };

  const handleUpdate = (d: { id: string; title: string; content: string; category: string }) => {
    update.mutate(d, {
      onSuccess: () => toast.success("Resposta atualizada!"),
      onError: (err) => toast.error(formatError(err)),
    });
  };

  const handleDelete = (id: string) => {
    remove.mutate(id, {
      onSuccess: () => toast.success("Resposta excluída!"),
      onError: (err) => toast.error(formatError(err)),
    });
  };

  const handleCreateCategory = (name: string) => {
    createCat.mutate(
      { name },
      {
        onSuccess: () => { toast.success("Categoria criada!"); setActiveCategory(name.trim()); },
        onError: (err) => toast.error(formatError(err)),
      }
    );
  };

  const handleRenameCategory = (oldName: string, newName: string) => {
    const row = categoryRows.find((c) => c.name === oldName);
    if (!row) {
      toast.error("Categoria não encontrada");
      return;
    }
    renameCat.mutate(
      { id: row.id, oldName, newName },
      {
        onSuccess: () => {
          toast.success("Categoria renomeada!");
          if (activeCategory === oldName) setActiveCategory(newName.trim());
        },
        onError: (err) => toast.error(formatError(err)),
      }
    );
  };

  const handleDeleteCategory = (name: string) => {
    const row = categoryRows.find((c) => c.name === name);
    if (!row) {
      toast.error("Categoria não encontrada");
      return;
    }
    removeCat.mutate(
      { id: row.id, name },
      {
        onSuccess: () => {
          toast.success("Categoria excluída!");
          if (activeCategory === name) setActiveCategory(null);
        },
        onError: (err) => toast.error(formatError(err)),
      }
    );
  };

  return (
    <div className="p-4 md:p-6 flex gap-4 h-full">
      <QuickRepliesSidebar
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
        onCreateCategory={handleCreateCategory}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
        counts={counts}
        total={data.length}
      />
      <QuickRepliesList
        items={data}
        categories={categories}
        activeCategory={activeCategory}
        onUpdate={handleUpdate}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
    </div>
  );
}
