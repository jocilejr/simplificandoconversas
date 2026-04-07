import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useSmtpConfig } from "@/hooks/useSmtpConfig";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  Plus, Send, Trash2, Loader2, X, ChevronDown, ChevronUp, Clock,
  Megaphone, FileEdit, CheckCircle, AlertCircle, MailCheck, ArrowLeft, Zap,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  draft: { label: "Rascunho", icon: FileEdit, className: "bg-muted text-muted-foreground" },
  auto: { label: "Automática", icon: Zap, className: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  sending: { label: "Enviando", icon: Loader2, className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  sent: { label: "Enviado", icon: CheckCircle, className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  failed: { label: "Falhou", icon: AlertCircle, className: "bg-destructive/15 text-destructive" },
};

export function EmailCampaignsTab() {
  const { campaigns, isLoading, addCampaign, sendCampaign, deleteCampaign } = useEmailCampaigns();
  const { templates } = useEmailTemplates();
  const { configs } = useSmtpConfig();
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [smtpConfigId, setSmtpConfigId] = useState("");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<{ templateId: string; delayDays: number }[]>([]);
  const [autoSend, setAutoSend] = useState(false);

  // Query tags from email_contacts instead of contact_tags
  const { data: tags = [] } = useQuery({
    queryKey: ["email-contact-tags"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("email_contacts").select("tags").eq("user_id", user.id);
      if (!data) return [];
      const allTags = data.flatMap((c: any) => c.tags || []);
      return [...new Set(allTags)].sort() as string[];
    },
  });

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
        campaign_id: campaignId, user_id: user.id, workspace_id: workspaceId!, template_id: tId, delay_days: delayDays, step_order: stepOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign-follow-ups"] }); toast({ title: "Follow-up adicionado!" }); },
  });

  const resetForm = () => {
    setName(""); setTemplateId(""); setTagFilter(""); setSmtpConfigId(""); setFollowUps([]); setAutoSend(false);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !templateId) return;
    addCampaign.mutate(
      {
        name, template_id: templateId,
        tag_filter: tagFilter && tagFilter !== "__all__" ? tagFilter : undefined,
        smtp_config_id: smtpConfigId || undefined,
        auto_send: autoSend,
      },
      {
        onSuccess: async (data: any) => {
          if (followUps.length > 0 && data?.id) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              for (let i = 0; i < followUps.length; i++) {
                await supabase.from("email_follow_ups").insert({
                  campaign_id: data.id, user_id: user.id, workspace_id: workspaceId!,
                  template_id: followUps[i].templateId, delay_days: followUps[i].delayDays, step_order: i + 1,
                });
              }
            }
          }
          resetForm();
        },
      }
    );
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  // Create form
  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetForm}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">Nova Campanha</h2>
        </div>

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nome da Campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Black Friday 2025" className="bg-card" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Filtrar por Tag</Label>
                <Select value={tagFilter || "__all__"} onValueChange={setTagFilter}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os contatos</SelectItem>
                    {tags.map((tag: string) => (<SelectItem key={tag} value={tag}>{tag}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto-send toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">Envio automático</p>
                  <p className="text-xs text-muted-foreground">
                    Envia automaticamente ao receber um contato com a tag selecionada
                  </p>
                </div>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} disabled={!tagFilter || tagFilter === "__all__"} />
            </div>

            {configs && configs.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Servidor SMTP</Label>
                <Select value={smtpConfigId} onValueChange={setSmtpConfigId}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="SMTP padrão" /></SelectTrigger>
                  <SelectContent>
                    {configs.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.label || c.from_email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Follow-ups */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs font-medium text-muted-foreground">Follow-ups (opcional)</Label>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setFollowUps([...followUps, { templateId: "", delayDays: 3 }])}>
                  <Plus className="h-3 w-3" /> Etapa
                </Button>
              </div>
              {followUps.map((fu, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                  <Badge variant="outline" className="shrink-0 text-[10px]">#{idx + 1}</Badge>
                  <Select value={fu.templateId} onValueChange={(v) => {
                    const next = [...followUps]; next[idx].templateId = v; setFollowUps(next);
                  }}>
                    <SelectTrigger className="flex-1 h-8 text-xs bg-card"><SelectValue placeholder="Template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground shrink-0">após</span>
                  <Input
                    type="number" min={1} className="w-16 h-8 text-xs bg-card"
                    value={fu.delayDays}
                    onChange={(e) => {
                      const next = [...followUps]; next[idx].delayDays = parseInt(e.target.value) || 1; setFollowUps(next);
                    }}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">dias</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setFollowUps(followUps.filter((_, i) => i !== idx))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={addCampaign.isPending} className="gap-1.5">
                {addCampaign.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Criar Campanha
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Campaign list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nova Campanha
        </Button>
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-16">
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-1">Nenhuma campanha criada</p>
          <p className="text-xs text-muted-foreground">Crie sua primeira campanha para disparar e-mails em massa</p>
        </div>
      )}

      <div className="grid gap-3">
        {campaigns.map((c: any) => {
          const displayStatus = c.auto_send && c.status === "draft" ? "auto" : c.status;
          const cfg = statusConfig[displayStatus] || statusConfig.draft;
          const StatusIcon = cfg.icon;
          const progress = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;

          return (
            <Card key={c.id} className="border-border bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-foreground">{c.name}</p>
                      <Badge variant="secondary" className={`gap-1 ${cfg.className}`}>
                        <StatusIcon className={`h-3 w-3 ${c.status === "sending" ? "animate-spin" : ""}`} />
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Template: <span className="text-foreground">{c.email_templates?.name || "—"}</span>
                      {" · "}Tag: <span className="text-foreground">{c.tag_filter || "Todos"}</span>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setExpandedCampaign(expandedCampaign === c.id ? null : c.id)}>
                      {expandedCampaign === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {c.status === "draft" && !c.auto_send && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" className="gap-1.5">
                            <Send className="h-3.5 w-3.5" /> Enviar
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

                {/* Progress bar */}
                {c.total_recipients > 0 && (
                  <div className="space-y-1.5">
                    <Progress value={progress} className="h-1.5" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1">
                          <MailCheck className="h-3 w-3 text-green-600" /> {c.sent_count} enviados
                        </span>
                        {c.failed_count > 0 && (
                          <span className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-destructive" /> {c.failed_count} falhas
                          </span>
                        )}
                        {c.opened_count > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-blue-500" /> {c.opened_count} abertos
                          </span>
                        )}
                      </div>
                      <span>{c.sent_count}/{c.total_recipients} ({progress}%)</span>
                    </div>
                  </div>
                )}

                {/* Expanded follow-ups */}
                {expandedCampaign === c.id && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Follow-ups
                      </p>
                      {c.status === "draft" && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                          onClick={() => {
                            if (templates.length > 0) {
                              addFollowUpMutation.mutate({
                                campaignId: c.id, templateId: templates[0].id,
                                delayDays: 3, stepOrder: (campaignFollowUps?.length || 0) + 1,
                              });
                            }
                          }}>
                          <Plus className="h-3 w-3" /> Adicionar
                        </Button>
                      )}
                    </div>
                    {campaignFollowUps.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhum follow-up configurado.</p>
                    ) : (
                      campaignFollowUps.map((fu: any, idx: number) => (
                        <div key={fu.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30 border border-border">
                          <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                          <span className="text-foreground">{(fu.email_templates as any)?.name || "—"}</span>
                          <span className="text-muted-foreground">após {fu.delay_days} dia{fu.delay_days > 1 ? "s" : ""}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
