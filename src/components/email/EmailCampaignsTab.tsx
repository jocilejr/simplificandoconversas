import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useSmtpConfig } from "@/hooks/useSmtpConfig";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Trash2, Loader2, X, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusColors: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  sent: "bg-green-500/20 text-green-700 dark:text-green-400",
  failed: "bg-destructive/20 text-destructive",
};
const statusLabels: Record<string, string> = {
  draft: "Rascunho", sending: "Enviando...", sent: "Enviado", failed: "Falhou",
};

export function EmailCampaignsTab() {
  const { campaigns, isLoading, addCampaign, sendCampaign, deleteCampaign } = useEmailCampaigns();
  const { templates } = useEmailTemplates();
  const { configs } = useSmtpConfig();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [smtpConfigId, setSmtpConfigId] = useState("");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  // Follow-up state
  const [followUps, setFollowUps] = useState<{ templateId: string; delayDays: number }[]>([]);

  const { data: tags = [] } = useQuery({
    queryKey: ["unique-tags"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("contact_tags").select("tag_name").eq("user_id", user.id);
      if (!data) return [];
      return [...new Set(data.map((t: any) => t.tag_name))].sort();
    },
  });

  // Load follow-ups for expanded campaign
  const { data: campaignFollowUps = [] } = useQuery({
    queryKey: ["campaign-follow-ups", expandedCampaign],
    queryFn: async () => {
      if (!expandedCampaign) return [];
      const { data } = await supabase
        .from("email_follow_ups")
        .select("*, email_templates(name)")
        .eq("campaign_id", expandedCampaign)
        .order("step_order");
      return data || [];
    },
    enabled: !!expandedCampaign,
  });

  const addFollowUpMutation = useMutation({
    mutationFn: async ({ campaignId, templateId: tId, delayDays, stepOrder }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("email_follow_ups").insert({
        campaign_id: campaignId,
        user_id: user.id,
        template_id: tId,
        delay_days: delayDays,
        step_order: stepOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign-follow-ups"] }); toast({ title: "Follow-up adicionado!" }); },
  });

  const resetForm = () => {
    setName(""); setTemplateId(""); setTagFilter(""); setSmtpConfigId(""); setFollowUps([]);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !templateId) return;
    addCampaign.mutate(
      {
        name,
        template_id: templateId,
        tag_filter: tagFilter && tagFilter !== "__all__" ? tagFilter : undefined,
        smtp_config_id: smtpConfigId || undefined,
      },
      {
        onSuccess: async (data: any) => {
          // Create follow-ups if any
          if (followUps.length > 0 && data?.id) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              for (let i = 0; i < followUps.length; i++) {
                await supabase.from("email_follow_ups").insert({
                  campaign_id: data.id,
                  user_id: user.id,
                  template_id: followUps[i].templateId,
                  delay_days: followUps[i].delayDays,
                  step_order: i + 1,
                });
              }
            }
          }
          resetForm();
        },
      }
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Filtrar por Tag</Label>
                <Select value={tagFilter || "__all__"} onValueChange={setTagFilter}>
                  <SelectTrigger><SelectValue placeholder="Todos os contatos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os contatos</SelectItem>
                    {tags.map((tag: string) => (<SelectItem key={tag} value={tag}>{tag}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {configs && configs.length > 1 && (
              <div className="space-y-1.5">
                <Label>Servidor SMTP</Label>
                <Select value={smtpConfigId} onValueChange={setSmtpConfigId}>
                  <SelectTrigger><SelectValue placeholder="SMTP padrão" /></SelectTrigger>
                  <SelectContent>
                    {configs.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.label || c.from_email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Follow-ups */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Follow-ups (opcional)</Label>
                <Button
                  variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => setFollowUps([...followUps, { templateId: "", delayDays: 3 }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Etapa
                </Button>
              </div>
              {followUps.map((fu, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                  <span className="text-xs text-muted-foreground shrink-0">Etapa {idx + 1}:</span>
                  <Select value={fu.templateId} onValueChange={(v) => {
                    const next = [...followUps]; next[idx].templateId = v; setFollowUps(next);
                  }}>
                    <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground shrink-0">após</span>
                  <Input
                    type="number" min={1} className="w-16 h-8 text-xs"
                    value={fu.delayDays}
                    onChange={(e) => {
                      const next = [...followUps]; next[idx].delayDays = parseInt(e.target.value) || 1; setFollowUps(next);
                    }}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">dias</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFollowUps(followUps.filter((_, i) => i !== idx))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
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
            <CardContent className="p-4 space-y-2">
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
                    {c.opened_count > 0 && ` • ${c.opened_count} abertos`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => setExpandedCampaign(expandedCampaign === c.id ? null : c.id)}>
                    {expandedCampaign === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
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
                            Os e-mails serão enviados para todos os contatos{c.tag_filter ? ` com a tag "${c.tag_filter}"` : ""} que possuem e-mail cadastrado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => sendCampaign.mutate(c.id)}>Confirmar Envio</AlertDialogAction>
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

              {/* Expanded: show follow-ups */}
              {expandedCampaign === c.id && (
                <div className="mt-2 pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Follow-ups
                    </p>
                    {c.status === "draft" && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs"
                        onClick={() => {
                          if (templates.length > 0) {
                            addFollowUpMutation.mutate({
                              campaignId: c.id,
                              templateId: templates[0].id,
                              delayDays: 3,
                              stepOrder: (campaignFollowUps?.length || 0) + 1,
                            });
                          }
                        }}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    )}
                  </div>
                  {campaignFollowUps.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum follow-up configurado.</p>
                  ) : (
                    campaignFollowUps.map((fu: any, idx: number) => (
                      <div key={fu.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                        <span className="text-muted-foreground">Etapa {idx + 1}:</span>
                        <span>{(fu.email_templates as any)?.name || "—"}</span>
                        <span className="text-muted-foreground">após {fu.delay_days} dias</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
