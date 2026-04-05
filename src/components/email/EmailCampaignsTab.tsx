import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Send, Trash2, Loader2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusColors: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  sent: "bg-green-500/20 text-green-700 dark:text-green-400",
  failed: "bg-destructive/20 text-destructive",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  sending: "Enviando...",
  sent: "Enviado",
  failed: "Falhou",
};

export function EmailCampaignsTab() {
  const { campaigns, isLoading, addCampaign, sendCampaign, deleteCampaign } = useEmailCampaigns();
  const { templates } = useEmailTemplates();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  // Load unique tags
  const { data: tags = [] } = useQuery({
    queryKey: ["unique-tags"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("contact_tags")
        .select("tag_name")
        .eq("user_id", user.id);
      if (!data) return [];
      return [...new Set(data.map((t: any) => t.tag_name))].sort();
    },
  });

  const resetForm = () => { setName(""); setTemplateId(""); setTagFilter(""); setShowForm(false); };

  const handleCreate = () => {
    if (!name.trim() || !templateId) return;
    addCampaign.mutate(
      { name, template_id: templateId, tag_filter: tagFilter || undefined },
      { onSuccess: resetForm }
    );
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Campanha
        </Button>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova Campanha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome da Campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Black Friday 2025" />
            </div>
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Filtrar por Tag (opcional)</Label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os contatos com e-mail" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os contatos</SelectItem>
                  {tags.map((tag: string) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={addCampaign.isPending}>
                {addCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Criar Campanha
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {campaigns.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
      )}

      <div className="grid gap-3">
        {campaigns.map((c: any) => (
          <Card key={c.id} className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{c.name}</p>
                    <Badge variant="secondary" className={statusColors[c.status] || ""}>
                      {statusLabels[c.status] || c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Template: {c.email_templates?.name || "—"} •
                    Tag: {c.tag_filter || "Todos"} •
                    {c.sent_count}/{c.total_recipients} enviados
                    {c.failed_count > 0 && ` • ${c.failed_count} falhas`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {c.status === "draft" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="default" size="sm">
                          <Send className="h-4 w-4 mr-1" /> Enviar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Enviar campanha?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Os e-mails serão enviados para todos os contatos{c.tag_filter ? ` com a tag "${c.tag_filter}"` : ""} que possuem e-mail cadastrado. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => sendCampaign.mutate(c.id)}>
                            Confirmar Envio
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {c.status === "draft" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCampaign.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
