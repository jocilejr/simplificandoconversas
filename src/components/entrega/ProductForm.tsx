import { useEffect, useState, useRef } from "react";
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(display: string): number {
  const digits = display.replace(/\D/g, "");
  return Number(digits) / 100;
}

export function ProductForm({ open, onOpenChange, product, workspaceId, userId }: Props) {
  const qc = useQueryClient();
  const isEdit = !!product;
  const slugManuallyEdited = useRef(false);
  const [valueDisplay, setValueDisplay] = useState("0,00");

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      name: "", slug: "", value: 0, is_active: true,
    },
  });

  const name = watch("name");

  useEffect(() => {
    if (product) {
      reset({
        name: product.name || "",
        slug: product.slug || "",
        value: product.value || 0,
        is_active: product.is_active ?? true,
      });
      setValueDisplay(formatCurrency((product.value || 0) * 100));
      slugManuallyEdited.current = true;
    } else {
      reset({ name: "", slug: "", value: 0, is_active: true });
      setValueDisplay("0,00");
      slugManuallyEdited.current = false;
    }
  }, [product, reset]);

  useEffect(() => {
    if (!isEdit && name && !slugManuallyEdited.current) {
      setValue("slug", slugify(name));
    }
  }, [name, isEdit, setValue]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const num = Number(raw) / 100;
    setValueDisplay(formatCurrency(Number(raw)));
    setValue("value", num);
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (!workspaceId) throw new Error("Workspace não encontrado");
      const payload = {
        name: data.name,
        slug: data.slug,
        value: data.value || 0,
        is_active: data.is_active,
        workspace_id: workspaceId,
      };
      if (isEdit) {
        const { workspace_id: _, ...updatePayload } = payload;
        const { error } = await supabase.from("delivery_products").update(updatePayload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_products").insert(payload);
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

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    slugManuallyEdited.current = true;
    setValue("slug", e.target.value);
  };

  const slug = watch("slug");

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
            <Input value={slug} onChange={handleSlugChange} placeholder="meu-produto" />
          </div>
          <div>
            <Label>Valor</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
              <Input
                value={valueDisplay}
                onChange={handleValueChange}
                className="pl-10 text-right font-mono"
                placeholder="0,00"
                inputMode="numeric"
              />
            </div>
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
