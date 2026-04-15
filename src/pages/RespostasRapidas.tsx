import { useState, useMemo } from "react";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { QuickRepliesSidebar } from "@/components/quick-replies/QuickRepliesSidebar";
import { QuickRepliesList } from "@/components/quick-replies/QuickRepliesList";
import { toast } from "sonner";

export default function RespostasRapidas() {
  const { data = [], create, update, remove, renameCategory } = useQuickReplies();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(data.map((d) => d.category));
    return Array.from(set).sort();
  }, [data]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((d) => {
      map[d.category] = (map[d.category] || 0) + 1;
    });
    return map;
  }, [data]);

  const handleCreate = (d: { title: string; content: string; category: string }) => {
    create.mutate(d, {
      onSuccess: () => toast.success("Resposta criada!"),
      onError: () => toast.error("Erro ao criar resposta"),
    });
  };

  const handleUpdate = (d: { id: string; title: string; content: string; category: string }) => {
    update.mutate(d, {
      onSuccess: () => toast.success("Resposta atualizada!"),
      onError: () => toast.error("Erro ao atualizar"),
    });
  };

  const handleDelete = (id: string) => {
    remove.mutate(id, {
      onSuccess: () => toast.success("Resposta excluída!"),
      onError: () => toast.error("Erro ao excluir"),
    });
  };

  const handleRenameCategory = (oldName: string, newName: string) => {
    renameCategory.mutate(
      { oldName, newName },
      {
        onSuccess: () => {
          toast.success("Categoria renomeada!");
          if (activeCategory === oldName) setActiveCategory(newName);
        },
        onError: () => toast.error("Erro ao renomear"),
      }
    );
  };

  return (
    <div className="p-4 md:p-6 flex gap-4 h-full">
      <QuickRepliesSidebar
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
        onRenameCategory={handleRenameCategory}
        counts={counts}
        total={data.length}
      />
      <QuickRepliesList
        items={data}
        categories={categories.length > 0 ? categories : ["Geral"]}
        activeCategory={activeCategory}
        onUpdate={handleUpdate}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
    </div>
  );
}
