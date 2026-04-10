import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function DeliverySettingsSection() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (settings && !loaded) {
    setMessage(settings.delivery_message || "");
    setLoaded(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { delivery_message: message || null } as any;
      if (settings) {
        const { error } = await supabase.from("delivery_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        payload.workspace_id = workspaceId;
        const { error } = await supabase.from("delivery_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações salvas!");
      queryClient.invalidateQueries({ queryKey: ["delivery-settings"] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const insertVariable = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = message.substring(0, start) + "{link}" + message.substring(end);
    setMessage(newVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + 6, start + 6);
    }, 0);
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Mensagem padrão de entrega</Label>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-accent text-xs"
                onClick={insertVariable}
              >
                {"{link}"} — Inserir variável
              </Badge>
            </div>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Olá! Seu acesso está liberado: {link}"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use <code className="bg-muted px-1 rounded">{"{link}"}</code> para posicionar o link de acesso na mensagem. Se não incluído, o link será adicionado na última linha.
            </p>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
