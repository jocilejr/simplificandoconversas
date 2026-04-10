import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ---- Ajustes Sub-tab ----
function AjustesTab() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["member-area-settings", workspaceId],
    queryFn: async () => {
      const { data } = await supabase.from("member_area_settings" as any).select("*").eq("workspace_id", workspaceId!).limit(1).maybeSingle();
      return data as any;
    },
    enabled: !!workspaceId,
  });

  const [title, setTitle] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [description, setDescription] = useState("");
  const [aiPersonaPrompt, setAiPersonaPrompt] = useState("");
  const [greetingPrompt, setGreetingPrompt] = useState("");
  const [offerPrompt, setOfferPrompt] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (settings && !loaded) {
    setTitle(settings.title || "Área de Membros");
    setFaviconUrl(settings.logo_url || "");
    setDescription(settings.welcome_message || "");
    setAiPersonaPrompt(settings.ai_persona_prompt || "");
    setGreetingPrompt(settings.greeting_prompt || "");
    setOfferPrompt(settings.offer_prompt || "");
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title,
        logo_url: faviconUrl || null,
        welcome_message: description,
        ai_persona_prompt: aiPersonaPrompt || null,
        greeting_prompt: greetingPrompt || null,
        offer_prompt: offerPrompt || null,
      };
      if (settings?.id) {
        const { error } = await supabase.from("member_area_settings" as any).update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        payload.workspace_id = workspaceId;
        const { error } = await supabase.from("member_area_settings" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações salvas!");
      queryClient.invalidateQueries({ queryKey: ["member-area-settings"] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label>Título da Página (tag title)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Área de Membros" />
          <p className="text-xs text-muted-foreground mt-1">Usado como título na aba do navegador, não exibido na página</p>
        </div>
        <div>
          <Label>Favicon (URL da imagem)</Label>
          <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://exemplo.com/favicon.png" />
          <p className="text-xs text-muted-foreground mt-1">Ícone exibido na aba do navegador</p>
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da sua área de membros..." />
        </div>
        <div className="border-t border-border pt-4 mt-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Prompts de IA</h3>
        </div>
        <div>
          <Label>Personalidade da IA (persona)</Label>
          <Textarea value={aiPersonaPrompt} onChange={(e) => setAiPersonaPrompt(e.target.value)} placeholder="Você é um assistente profissional..." rows={4} />
          <p className="text-xs text-muted-foreground mt-1">Define como a IA se comporta no chat e nas ofertas</p>
        </div>
        <div>
          <Label>Prompt da Saudação Inicial</Label>
          <Textarea value={greetingPrompt} onChange={(e) => setGreetingPrompt(e.target.value)} placeholder="Gere uma frase curta de boas-vindas..." rows={6} />
          <p className="text-xs text-muted-foreground mt-1">Prompt para gerar mensagem de boas-vindas. Deixe vazio para usar o padrão.</p>
        </div>
        <div>
          <Label>Prompt da Copy de Oferta</Label>
          <Textarea value={offerPrompt} onChange={(e) => setOfferPrompt(e.target.value)} placeholder="Gere mensagens de venda naturais..." rows={8} />
          <p className="text-xs text-muted-foreground mt-1">Prompt para gerar mensagens de venda. Deixe vazio para usar o padrão.</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- Domínio Sub-tab ----
function DominioTab() {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newDomain, setNewDomain] = useState("");

  // Fetch domains
  const { data: domains = [], isLoading: domainsLoading } = useQuery({
    queryKey: ["workspace-domains", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_domains")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch delivery settings
  const { data: settings } = useQuery({
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

  const activeDomains = domains.filter((d) => d.is_active);
  const selectedDomain = settings?.custom_domain || "";

  // Add domain
  const addMut = useMutation({
    mutationFn: async (domain: string) => {
      const { error } = await supabase.from("workspace_domains").insert({
        workspace_id: workspaceId!,
        domain: domain.trim().toLowerCase(),
        is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Domínio adicionado");
      setNewDomain("");
      qc.invalidateQueries({ queryKey: ["workspace-domains"] });
    },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Domínio já cadastrado" : e.message),
  });

  // Toggle active
  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("workspace_domains").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-domains"] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Remove domain
  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_domains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Domínio removido");
      qc.invalidateQueries({ queryKey: ["workspace-domains"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Save delivery settings (selected domain)
  const saveMut = useMutation({
    mutationFn: async (customDomain: string) => {
      const data = { custom_domain: customDomain || null } as any;
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

  if (domainsLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  const serverHost = (() => {
    try {
      return new URL(import.meta.env.VITE_SUPABASE_URL || window.location.origin).hostname;
    } catch {
      return window.location.hostname;
    }
  })();

  return (
    <div className="space-y-4">
      {/* Domínios Cadastrados */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Domínios Cadastrados</h3>
          </div>

          {domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum domínio cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono">{d.domain}</span>
                    <Badge variant={d.is_active ? "default" : "secondary"} className="text-xs">
                      {d.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={d.is_active}
                      onCheckedChange={(checked) => toggleMut.mutate({ id: d.id, is_active: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeMut.mutate(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="membros.meusite.com"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newDomain.trim()) addMut.mutate(newDomain);
              }}
            />
            <Button
              onClick={() => newDomain.trim() && addMut.mutate(newDomain)}
              disabled={!newDomain.trim() || addMut.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seleção do domínio da Área de Membros */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Domínio da Área de Membros</h3>
          <p className="text-xs text-muted-foreground">
            Selecione qual domínio ativo será usado como URL da sua área de membros.
          </p>

          <Select
            value={selectedDomain || "__default__"}
            onValueChange={(val) => {
              const domain = val === "__default__" ? "" : val;
              saveMut.mutate(domain);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um domínio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">Domínio padrão (servidor)</SelectItem>
              {activeDomains.map((d) => (
                <SelectItem key={d.id} value={d.domain}>
                  {d.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeDomains.length === 0 && (
            <p className="text-xs text-amber-500">
              ⚠️ Nenhum domínio ativo. Ative um domínio acima para poder selecioná-lo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Instruções DNS */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Instruções de DNS</h3>
          <div className="border rounded-md p-4 bg-muted/30 space-y-3">
            <p className="text-xs text-muted-foreground">
              No painel DNS do seu provedor de domínio, crie o seguinte registro apontando para o IP da sua VPS:
            </p>
            <div className="text-xs font-mono space-y-1 bg-background p-3 rounded border">
              <p className="text-muted-foreground mb-1">Registro A — aponta seu subdomínio para o servidor</p>
              <p><strong>Tipo:</strong> A</p>
              <p><strong>Nome:</strong> membros <span className="text-muted-foreground">(ou o subdomínio desejado)</span></p>
              <p><strong>Valor:</strong> <span className="text-primary font-bold">{serverHost}</span></p>
            </div>
            <p className="text-xs text-amber-500">
              ⚠️ Após criar o registro, aguarde até 24h para propagação do DNS.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

// ---- Main Section ----
export function MemberAreaSettingsSection() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="ajustes">
        <TabsList>
          <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
          <TabsTrigger value="dominio">Domínio</TabsTrigger>
        </TabsList>
        <TabsContent value="ajustes" className="mt-4">
          <AjustesTab />
        </TabsContent>
        <TabsContent value="dominio" className="mt-4">
          <DominioTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
