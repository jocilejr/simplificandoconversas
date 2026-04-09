import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
          <Textarea value={aiPersonaPrompt} onChange={(e) => setAiPersonaPrompt(e.target.value)} placeholder="Você é um assistente profissional. Fala com clareza e objetividade." rows={4} />
          <p className="text-xs text-muted-foreground mt-1">Define como a IA se comporta no chat e nas ofertas</p>
        </div>
        <div>
          <Label>Prompt da Saudação Inicial</Label>
          <Textarea value={greetingPrompt} onChange={(e) => setGreetingPrompt(e.target.value)} placeholder="Gere uma frase curta de boas-vindas personalizada..." rows={6} />
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

  const [customDomain, setCustomDomain] = useState("");
  const [globalRedirectUrl, setGlobalRedirectUrl] = useState("");
  const [linkMessageTemplate, setLinkMessageTemplate] = useState("Olá! Aqui está seu acesso: {link}");
  const [loaded, setLoaded] = useState(false);

  if (settings && !loaded) {
    setCustomDomain(settings.custom_domain || "");
    setGlobalRedirectUrl(settings.global_redirect_url || "");
    setLinkMessageTemplate(settings.link_message_template || "Olá! Aqui está seu acesso: {link}");
    setLoaded(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const data = { custom_domain: customDomain || null, global_redirect_url: globalRedirectUrl || null, link_message_template: linkMessageTemplate };
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

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="border rounded-md p-4 bg-muted/30 space-y-2">
          <h4 className="font-medium text-sm">Configuração de DNS</h4>
          <p className="text-xs text-muted-foreground">
            Para usar um domínio personalizado na sua área de membros, aponte o domínio para o IP do seu servidor:
          </p>
          <div className="text-xs font-mono space-y-1 bg-background p-3 rounded border">
            <p><strong>Tipo:</strong> A</p>
            <p><strong>Nome:</strong> membros (ou o subdomínio desejado)</p>
            <p><strong>Valor:</strong> IP do seu servidor VPS</p>
          </div>
          <div className="text-xs font-mono space-y-1 bg-background p-3 rounded border mt-2">
            <p><strong>TXT (verificação):</strong></p>
            <p>_verify → workspace-{workspaceId?.slice(0, 8)}</p>
          </div>
        </div>

        <div>
          <Label>Domínio Personalizado</Label>
          <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="membros.meusite.com" />
          <p className="text-xs text-muted-foreground mt-1">
            Domínio que será usado para acessar a área de membros pública. Deixe vazio para usar o domínio padrão.
          </p>
        </div>
        <div>
          <Label>URL de Redirecionamento Global</Label>
          <Input value={globalRedirectUrl} onChange={(e) => setGlobalRedirectUrl(e.target.value)} placeholder="https://meusite.com/obrigado" />
          <p className="text-xs text-muted-foreground mt-1">
            Usado quando o produto não possui URL de redirecionamento própria
          </p>
        </div>
        <div>
          <Label>Template da Mensagem de Link</Label>
          <Textarea value={linkMessageTemplate} onChange={(e) => setLinkMessageTemplate(e.target.value)} rows={3} />
          <p className="text-xs text-muted-foreground mt-1">
            Use <code className="bg-muted px-1 rounded">{"{link}"}</code> onde o link deve aparecer
          </p>
        </div>

        <Button onClick={() => saveMut.mutate()} className="w-full" disabled={saveMut.isPending}>
          {saveMut.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
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
