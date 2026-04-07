import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Loader2, GripVertical, Calendar, MessageSquare, FileText, Image } from "lucide-react";

interface MediaBlock { type: "pdf" | "image"; enabled: boolean; }

interface RecoveryRule {
  id: string; name: string;
  rule_type: "days_after_generation" | "days_before_due" | "days_after_due";
  days: number; message: string; is_active: boolean; priority: number;
  media_blocks: MediaBlock[];
}

const RULE_TYPE_LABELS: Record<string, string> = {
  days_after_generation: "Dias após geração",
  days_before_due: "Dias antes do vencimento",
  days_after_due: "Dias após vencimento",
};

const VARIABLE_HINTS = [
  { var: "{saudação}", desc: "Bom dia/tarde/noite" },
  { var: "{nome}", desc: "Nome completo" },
  { var: "{primeiro_nome}", desc: "Primeiro nome" },
  { var: "{valor}", desc: "Valor do boleto" },
  { var: "{vencimento}", desc: "Data de vencimento" },
  { var: "{codigo_barras}", desc: "Código de barras" },
];

const DEFAULT_MEDIA_BLOCKS: MediaBlock[] = [
  { type: "pdf", enabled: false },
  { type: "image", enabled: false },
];

function getMediaBlocks(rule: Partial<RecoveryRule>): MediaBlock[] {
  if (!rule.media_blocks || !Array.isArray(rule.media_blocks) || rule.media_blocks.length === 0) return [...DEFAULT_MEDIA_BLOCKS];
  return rule.media_blocks;
}

function isMediaEnabled(blocks: MediaBlock[], type: "pdf" | "image"): boolean {
  return blocks.find((b) => b.type === type)?.enabled ?? false;
}

function toggleMedia(blocks: MediaBlock[], type: "pdf" | "image"): MediaBlock[] {
  return blocks.map((b) => (b.type === type ? { ...b, enabled: !b.enabled } : b));
}

export function FollowUpRulesConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const [editingRule, setEditingRule] = useState<Partial<RecoveryRule> | null>(null);
  const [expirationDays, setExpirationDays] = useState("");

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["boleto-settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.from("boleto_settings" as any).select("*").eq("workspace_id", workspaceId!).maybeSingle();
      if (error) throw error;
      if (data) setExpirationDays((data as any).default_expiration_days.toString());
      return data as any;
    },
  });

  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ["boleto-recovery-rules-all", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.from("boleto_recovery_rules" as any).select("*").eq("workspace_id", workspaceId!).order("priority", { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown as RecoveryRule[]).map((r) => ({ ...r, media_blocks: getMediaBlocks(r) }));
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (days: number) => {
      if (!workspaceId || !user?.id) throw new Error("No workspace");
      if (!settings?.id) {
        const { error } = await supabase.from("boleto_settings" as any).insert({ workspace_id: workspaceId, user_id: user.id, default_expiration_days: days });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("boleto_settings" as any).update({ default_expiration_days: days }).eq("id", settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: "Sucesso", description: "Dias para vencimento atualizados" }); queryClient.invalidateQueries({ queryKey: ["boleto-settings", workspaceId] }); },
    onError: () => { toast({ title: "Erro", description: "Não foi possível salvar", variant: "destructive" }); },
  });

  const saveRule = useMutation({
    mutationFn: async (rule: Partial<RecoveryRule>) => {
      if (!workspaceId || !user?.id) throw new Error("No workspace");
      const blocks = getMediaBlocks(rule);
      const mediaBlocksJson = JSON.parse(JSON.stringify(blocks));
      if (rule.id) {
        const { error } = await supabase.from("boleto_recovery_rules" as any).update({ name: rule.name, rule_type: rule.rule_type, days: rule.days, message: rule.message, is_active: rule.is_active, media_blocks: mediaBlocksJson }).eq("id", rule.id);
        if (error) throw error;
      } else {
        const maxPriority = rules?.reduce((max, r) => Math.max(max, r.priority), 0) || 0;
        const { error } = await supabase.from("boleto_recovery_rules" as any).insert({ workspace_id: workspaceId, user_id: user.id, name: rule.name, rule_type: rule.rule_type, days: rule.days, message: rule.message, is_active: rule.is_active ?? true, priority: maxPriority + 1, media_blocks: mediaBlocksJson });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: "Sucesso", description: "Regra salva" }); setEditingRule(null); queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules-all", workspaceId] }); queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules", workspaceId] }); },
    onError: () => { toast({ title: "Erro", description: "Não foi possível salvar", variant: "destructive" }); },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("boleto_recovery_rules" as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules-all", workspaceId] }); queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules", workspaceId] }); },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boleto_recovery_rules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Sucesso", description: "Regra removida" }); queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules-all", workspaceId] }); queryClient.invalidateQueries({ queryKey: ["boleto-recovery-rules", workspaceId] }); },
    onError: () => { toast({ title: "Erro", description: "Não foi possível remover", variant: "destructive" }); },
  });

  if (loadingSettings || loadingRules) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4" />Dias para Vencimento do Boleto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Quantidade de dias após a geração para calcular o vencimento do boleto</p>
          <div className="flex gap-2 items-end">
            <div className="space-y-2 flex-1 max-w-[200px]">
              <Label htmlFor="expDays">Dias</Label>
              <Input id="expDays" type="number" min="1" max="30" value={expirationDays} onChange={(e) => setExpirationDays(e.target.value)} />
            </div>
            <Button onClick={() => { const days = parseInt(expirationDays); if (isNaN(days) || days < 1 || days > 30) { toast({ title: "Erro", description: "Digite um valor entre 1 e 30", variant: "destructive" }); return; } updateSettings.mutate(days); }} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" />Régua de Cobrança</CardTitle>
            <Button onClick={() => setEditingRule({ name: "", rule_type: "days_after_generation", days: 1, message: "{saudação}, {primeiro_nome}! ", is_active: true, media_blocks: [...DEFAULT_MEDIA_BLOCKS] })} size="sm" className="gap-1"><Plus className="h-4 w-4" />Nova Regra</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingRule && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da regra</Label>
                    <Input placeholder="Ex: 1 dia após geração" value={editingRule.name || ""} onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <div className="space-y-2 flex-1">
                      <Label>Tipo</Label>
                      <Select value={editingRule.rule_type} onValueChange={(v) => setEditingRule({ ...editingRule, rule_type: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days_after_generation">Dias após geração</SelectItem>
                          <SelectItem value="days_before_due">Dias antes do vencimento</SelectItem>
                          <SelectItem value="days_after_due">Dias após vencimento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 w-20">
                      <Label>Dias</Label>
                      <Input type="number" min="0" value={editingRule.days ?? 1} onChange={(e) => setEditingRule({ ...editingRule, days: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground mr-1 shrink-0">Variáveis:</span>
                  {VARIABLE_HINTS.map((v) => (
                    <button key={v.var} type="button" onClick={() => setEditingRule({ ...editingRule, message: (editingRule.message || "") + v.var })} className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-mono font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer shrink-0" title={v.desc}>{v.var}</button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea placeholder="Digite a mensagem de recuperação..." value={editingRule.message || ""} onChange={(e) => setEditingRule({ ...editingRule, message: e.target.value })} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Anexos de mídia</Label>
                  <p className="text-xs text-muted-foreground">Escolha quais arquivos enviar junto com a mensagem</p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button type="button" onClick={() => setEditingRule({ ...editingRule, media_blocks: toggleMedia(getMediaBlocks(editingRule), "pdf") })} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isMediaEnabled(getMediaBlocks(editingRule), "pdf") ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-border/50 bg-secondary/20 text-muted-foreground"}`}>
                      <FileText className="h-4 w-4" /><span className="text-sm font-medium">PDF do boleto</span>
                    </button>
                    <button type="button" onClick={() => setEditingRule({ ...editingRule, media_blocks: toggleMedia(getMediaBlocks(editingRule), "image") })} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isMediaEnabled(getMediaBlocks(editingRule), "image") ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-border/50 bg-secondary/20 text-muted-foreground"}`}>
                      <Image className="h-4 w-4" /><span className="text-sm font-medium">Imagem do boleto</span>
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setEditingRule(null)}>Cancelar</Button>
                  <Button onClick={() => { if (!editingRule.name || !editingRule.message) { toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" }); return; } saveRule.mutate(editingRule); }} disabled={saveRule.isPending}>
                    {saveRule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {rules && rules.length > 0 ? rules.map((rule) => (
              <div key={rule.id} className={`flex items-center gap-2 sm:gap-3 p-3 border rounded-lg transition-opacity ${!rule.is_active ? "opacity-50" : ""}`}>
                <GripVertical className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{rule.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{`${rule.days} ${RULE_TYPE_LABELS[rule.rule_type]?.split(" ").slice(1).join(" ")}`}</Badge>
                    <Badge variant="secondary" className="text-[10px] shrink-0 gap-1"><MessageSquare className="h-2.5 w-2.5" />TXT</Badge>
                    {isMediaEnabled(rule.media_blocks, "pdf") && <Badge className="text-[10px] shrink-0 gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30"><FileText className="h-2.5 w-2.5" />PDF</Badge>}
                    {isMediaEnabled(rule.media_blocks, "image") && <Badge className="text-[10px] shrink-0 gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><Image className="h-2.5 w-2.5" />IMG</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">{rule.message}</p>
                </div>
                <Switch checked={rule.is_active} onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })} />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingRule({ ...rule })}><MessageSquare className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => deleteRule.mutate(rule.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )) : (
              <div className="text-center py-8 text-muted-foreground"><p className="text-sm">Nenhuma regra criada</p><p className="text-xs mt-1">Crie regras para definir quando contatar clientes</p></div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
