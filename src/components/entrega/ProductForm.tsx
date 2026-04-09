import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
      delivery_webhook_url: "", redirect_url: "",
      whatsapp_number: "", whatsapp_message: "",
      page_title: "Preparando sua entrega...",
      page_message: "Você será redirecionado em instantes",
      redirect_delay: 3, page_logo: "",
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name || "",
        slug: product.slug || "",
        value: product.value || 0,
        is_active: product.is_active ?? true,
        delivery_webhook_url: product.delivery_webhook_url || "",
        redirect_url: product.redirect_url || "",
        whatsapp_number: product.whatsapp_number || "",
        whatsapp_message: product.whatsapp_message || "",
        page_title: product.page_title || "Preparando sua entrega...",
        page_message: product.page_message || "Você será redirecionado em instantes",
        redirect_delay: product.redirect_delay ?? 3,
        page_logo: product.page_logo || "",
      });
    } else {
      reset({
        name: "", slug: "", value: 0, is_active: true,
        delivery_webhook_url: "", redirect_url: "",
        whatsapp_number: "", whatsapp_message: "",
        page_title: "Preparando sua entrega...",
        page_message: "Você será redirecionado em instantes",
        redirect_delay: 3, page_logo: "",
      });
    }
  }, [product, reset]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data, workspace_id: workspaceId };
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Tabs defaultValue="basico">
            <TabsList className="w-full">
              <TabsTrigger value="basico" className="flex-1">Básico</TabsTrigger>
              <TabsTrigger value="pagina" className="flex-1">Página</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-3 mt-3">
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
              <div>
                <Label>Webhook URL</Label>
                <Input {...register("delivery_webhook_url")} placeholder="https://..." />
              </div>
              <div>
                <Label>URL de Redirecionamento</Label>
                <Input {...register("redirect_url")} placeholder="https://..." />
              </div>
              <div>
                <Label>WhatsApp (número)</Label>
                <Input {...register("whatsapp_number")} placeholder="5511999999999" />
              </div>
              <div>
                <Label>Mensagem WhatsApp</Label>
                <Textarea {...register("whatsapp_message")} placeholder="Olá, obrigado pela compra!" rows={3} />
              </div>
            </TabsContent>

            <TabsContent value="pagina" className="space-y-3 mt-3">
              <div>
                <Label>Logo URL</Label>
                <Input {...register("page_logo")} placeholder="https://..." />
              </div>
              <div>
                <Label>Título da Página</Label>
                <Input {...register("page_title")} />
              </div>
              <div>
                <Label>Mensagem da Página</Label>
                <Textarea {...register("page_message")} rows={2} />
              </div>
              <div>
                <Label>Delay de Redirecionamento (segundos)</Label>
                <Input type="number" {...register("redirect_delay", { valueAsNumber: true })} />
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : isEdit ? "Atualizar" : "Criar Produto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
