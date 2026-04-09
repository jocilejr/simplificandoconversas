import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Copy, Trash2, Pencil, Package, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ProductForm } from "./ProductForm";
import { DeliveryFlowDialog } from "./DeliveryFlowDialog";

export function ProductsTab() {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["delivery-products", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_products")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const duplicateMut = useMutation({
    mutationFn: async (product: any) => {
      const { id, created_at, updated_at, ...rest } = product;
      const { error } = await supabase.from("delivery_products").insert({
        ...rest,
        name: `${rest.name} (cópia)`,
        slug: `${rest.slug}-copy-${Date.now().toString(36)}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-products"] });
      toast.success("Produto duplicado");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-products"] });
      toast.success("Produto excluído");
    },
  });

  const filtered = (products || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search + New */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm bg-muted/30 border-border/50"
          />
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingProduct(null); setFormOpen(true); }}
          className="h-9 text-xs gap-1.5 px-3"
        >
          <Plus className="h-3.5 w-3.5" /> Novo Produto
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 mb-3">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3 transition-all duration-200 hover:border-border/70 hover:shadow-sm cursor-pointer"
              onClick={() => setSelectedProduct(p)}
            >
              {/* Icon */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                <Package className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <Badge
                    variant={p.is_active ? "default" : "secondary"}
                    className="text-[9px] font-normal px-1.5 py-0 h-4 rounded"
                  >
                    {p.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-muted-foreground font-mono">/{p.slug}</span>
                  <span className="text-[11px] font-medium text-foreground/70 font-mono">
                    R$ {Number(p.value).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingProduct(p); setFormOpen(true); }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateMut.mutate(p); }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  title="Duplicar"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm("Excluir este produto?")) deleteMut.mutate(p.id); }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Chevron */}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 transition-colors" />
            </div>
          ))}
        </div>
      )}

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        workspaceId={workspaceId}
        userId={user?.id}
      />

      {selectedProduct && (
        <DeliveryFlowDialog
          open={!!selectedProduct}
          onOpenChange={(o) => !o && setSelectedProduct(null)}
          product={selectedProduct}
          workspaceId={workspaceId}
          userId={user?.id}
        />
      )}
    </div>
  );
}
