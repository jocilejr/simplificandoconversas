import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: any;
  workspaceId: string | null;
  userId: string | undefined;
}

export function ProductForm({ open, onOpenChange, product, workspaceId, userId }: Props) {
  const qc = useQueryClient();
  const isEdit = !!product;

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      name: "", slug: "", value: 0, is_active: true,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name || "",
        slug: product.slug || "",
        value: product.value || 0,
        is_active: product.is_active ?? true,
      });
    } else {
      reset({ name: "", slug: "", value: 0, is_active: true });
    }
  }, [product, reset]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { name: data.name, slug: data.slug, value: data.value, is_active: data.is_active, workspace_id: workspaceId };
      if (isEdit) {
        const { error } = await supabase.from("delivery_products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_products").insert({ ...payload, workspace_id: workspaceId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-products"] });
      toast.success(isEdit ? "Produto atualizado" : "Produto criado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isActive = watch("is_active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input {...register("name", { required: true })} placeholder="Meu Produto Digital" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input {...register("slug", { required: true })} placeholder="meu-produto" />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" {...register("value", { valueAsNumber: true })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={(v) => setValue("is_active", v)} />
            <Label>Ativo</Label>
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : isEdit ? "Atualizar" : "Criar Produto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
