import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DomainSettings() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["delivery-settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_settings")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return data;
    },
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      custom_domain: "",
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        custom_domain: settings.custom_domain || "",
      });
    }
  }, [settings, reset]);

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      if (settings) {
        const { error } = await supabase.from("delivery_settings").update(data).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_settings").insert({ ...data, workspace_id: workspaceId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-settings"] });
      toast.success("Configurações salvas");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de Domínio e Mensagem</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => saveMut.mutate(d))} className="space-y-4">
          <div>
            <Label>Domínio Personalizado</Label>
            <Input {...register("custom_domain")} placeholder="entrega.meusite.com" />
            <p className="text-xs text-muted-foreground mt-1">
              Configure um CNAME apontando para seu servidor. Deixe vazio para usar o domínio padrão.
            </p>
          </div>

          <div className="border rounded-md p-4 bg-muted/30 space-y-2">
            <h4 className="font-medium text-sm">Configuração de DNS</h4>
            <p className="text-xs text-muted-foreground">
              Para usar um domínio personalizado, adicione os seguintes registros DNS:
            </p>
            <div className="text-xs font-mono space-y-1">
              <p>CNAME  entrega  →  seu-servidor.com</p>
              <p>TXT    _verify  →  workspace-{workspaceId?.slice(0, 8)}</p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saveMut.isPending}>
            {saveMut.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
