import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Check, Settings2, Loader2, Eye, EyeOff, Copy, Trash2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AISection } from "@/components/settings/AISection";
import { IntegrationApiSection } from "@/components/settings/IntegrationApiSection";
import { EmailSettingsSection } from "@/components/settings/EmailSettingsSection";
import mercadopagoLogo from "@/assets/mercadopago-logo.svg";

const PlatformIcons: Record<string, React.ReactNode> = {
  mercadopago: (
    <img src={mercadopagoLogo} alt="Mercado Pago" className="h-8" />
  ),
  openpix: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><circle cx="24" cy="24" r="24" fill="#03d69d"/><text x="24" y="30" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold" fontFamily="sans-serif">W</text></svg>
  ),
  yampi: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="10" fill="#7c3aed"/><text x="24" y="32" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="bold" fontFamily="sans-serif">Y</text></svg>
  ),
  manual_payment: (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  stripe: (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#635bff"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/></svg>
  ),
  meta_ads: (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#0081fb"><path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/></svg>
  ),
  pagbank: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="10" fill="#00a94f"/><text x="24" y="32" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold" fontFamily="sans-serif">PB</text></svg>
  ),
  asaas: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="10" fill="#1e6fff"/><text x="24" y="32" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" fontFamily="sans-serif">asaas</text></svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#412991"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  custom_api: (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 18 2-2h2l1.36-1.36a6.5 6.5 0 1 0-3.997-3.992L2 18v4h4l2-2"/>
      <circle cx="17" cy="7" r="1"/>
    </svg>
  ),
};

interface Integration {
  id: string;
  name: string;
  description: string;
  platform: string;
  icon: string;
  available: boolean;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
  webhookPath?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "mercadopago",
    name: "Mercado Pago",
    description: "Gerar boletos e cobranças PIX",
    platform: "mercadopago",
    icon: "",
    available: true,
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "APP_USR-...", type: "password" },
      { key: "public_key", label: "Public Key", placeholder: "APP_USR-...", type: "password" },
    ],
    webhookPath: "/functions/v1/payment/webhook/boleto",
  },
  {
    id: "openpix",
    name: "Woovi / OpenPix",
    description: "Cobranças PIX com QR Code",
    platform: "openpix",
    icon: "",
    available: true,
    fields: [
      { key: "app_id", label: "App ID", placeholder: "Q2xpZW50ZV9JZi...", type: "password" },
    ],
    webhookPath: "/functions/v1/payment-openpix/webhook",
  },
  {
    id: "yampi",
    name: "Yampi",
    description: "Pagamentos e carrinho abandonado via n8n",
    platform: "yampi",
    icon: "",
    available: true,
    fields: [],
    webhookPath: "/functions/v1/yampi-webhook",
  },
  {
    id: "manual_payment",
    name: "Webhook PIX/Cartão",
    description: "Receba pagamentos via webhook genérico (sem autenticação)",
    platform: "manual_payment",
    icon: "",
    available: true,
    fields: [],
    webhookPath: "/functions/v1/manual-payment/webhook",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Pagamentos internacionais",
    platform: "stripe",
    icon: "",
    available: false,
    fields: [],
  },
  // Meta Ads removed from here — handled as multi-account below
  {
    id: "pagbank",
    name: "PagBank",
    description: "Boletos e PIX",
    platform: "pagbank",
    icon: "",
    available: false,
    fields: [],
  },
  {
    id: "asaas",
    name: "Asaas",
    description: "Cobranças recorrentes",
    platform: "asaas",
    icon: "",
    available: false,
    fields: [],
  },
];

// Special module platforms (open full-screen panels)
const SPECIAL_PLATFORMS = [
  { id: "openai", name: "OpenAI", description: "Inteligência artificial para respostas automáticas", platform: "openai" },
  { id: "email_module", name: "E-mail", description: "SMTP, webhooks e chave de API", platform: "email" },
  { id: "api_module", name: "API", description: "Chave de API e documentação de endpoints", platform: "custom_api" },
];

export function IntegrationsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { profile } = useProfile();
  const { workspaceId } = useWorkspace();
  const [workspaceUrl, setWorkspaceUrl] = useState<string | null>(null);
  const [connections, setConnections] = useState<Record<string, { id: string; credentials: any; enabled: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [configDialog, setConfigDialog] = useState<Integration | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Special panel state (openai, email, api)
  const [specialPanel, setSpecialPanel] = useState<string | null>(null);

  // Meta Ads multi-account state
  type MetaAccount = { id: string; label: string; access_token: string; ad_account_id: string; enabled: boolean };
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [metaDialog, setMetaDialog] = useState(false);
  const [editingMeta, setEditingMeta] = useState<MetaAccount | null>(null);
  const [metaForm, setMetaForm] = useState({ label: "", access_token: "", ad_account_id: "" });
  const [metaShowToken, setMetaShowToken] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);

  const loadMetaAccounts = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("meta_ad_accounts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at");
    setMetaAccounts((data as MetaAccount[]) || []);
  };

  useEffect(() => {
    if (!user || !workspaceId) return;
    loadConnections();
    loadMetaAccounts();
    supabase.from("workspaces").select("app_public_url, api_public_url").eq("id", workspaceId).single().then(({ data }) => {
      if (data?.api_public_url) setWorkspaceUrl(data.api_public_url);
      else if (data?.app_public_url) setWorkspaceUrl(data.app_public_url.replace("://app.", "://api."));
    });
  }, [user, workspaceId]);

  const loadConnections = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("workspace_id", workspaceId);
    const map: typeof connections = {};
    data?.forEach((c) => {
      map[c.platform] = { id: c.id, credentials: c.credentials, enabled: c.enabled ?? true };
    });
    setConnections(map);
    setLoading(false);
  };

  const openConfig = (integration: Integration) => {
    const existing = connections[integration.platform];
    const vals: Record<string, string> = {};
    integration.fields.forEach((f) => {
      vals[f.key] = (existing?.credentials as any)?.[f.key] || "";
    });
    setFormValues(vals);
    setShowSecret({});
    setConfigDialog(integration);
  };

  const handleSave = async () => {
    if (!configDialog || !user) return;
    setSaving(true);
    const credentials = { ...formValues };
    const existing = connections[configDialog.platform];

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("platform_connections")
        .update({ credentials, enabled: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("platform_connections")
        .insert({ user_id: user.id, workspace_id: workspaceId!, platform: configDialog.platform, credentials, enabled: true }));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Integração salva com sucesso" });
      await loadConnections();
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    if (!configDialog) return;
    const existing = connections[configDialog.platform];
    if (!existing) return;
    setSaving(true);
    await supabase.from("platform_connections").delete().eq("id", existing.id);
    toast({ title: "Integração desconectada" });
    await loadConnections();
    setConfigDialog(null);
    setSaving(false);
  };

  const openMetaAdd = () => {
    setEditingMeta(null);
    setMetaForm({ label: "", access_token: "", ad_account_id: "" });
    setMetaShowToken(false);
    setMetaDialog(true);
  };

  const openMetaEdit = (acc: MetaAccount) => {
    setEditingMeta(acc);
    setMetaForm({ label: acc.label, access_token: acc.access_token, ad_account_id: acc.ad_account_id });
    setMetaShowToken(false);
    setMetaDialog(true);
  };

  const handleMetaSave = async () => {
    if (!user || !workspaceId) return;
    setMetaSaving(true);
    const payload = { ...metaForm, workspace_id: workspaceId, enabled: true };

    let error;
    if (editingMeta) {
      ({ error } = await supabase.from("meta_ad_accounts").update({ ...metaForm, updated_at: new Date().toISOString() }).eq("id", editingMeta.id));
    } else {
      ({ error } = await supabase.from("meta_ad_accounts").insert(payload as any));
    }

    if (error) {
      toast({ title: "Erro ao salvar conta", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingMeta ? "Conta atualizada" : "Conta adicionada" });
      await loadMetaAccounts();
      setMetaDialog(false);
    }
    setMetaSaving(false);
  };

  const handleMetaToggle = async (acc: MetaAccount) => {
    await supabase.from("meta_ad_accounts").update({ enabled: !acc.enabled, updated_at: new Date().toISOString() }).eq("id", acc.id);
    await loadMetaAccounts();
  };

  const handleMetaDelete = async (id: string) => {
    await supabase.from("meta_ad_accounts").delete().eq("id", id);
    toast({ title: "Conta removida" });
    await loadMetaAccounts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-xs text-muted-foreground">Conecte serviços externos e configure módulos da plataforma</p>
      </div>

      <Tabs defaultValue="platforms" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="platforms" className="gap-1.5 text-xs"><Puzzle className="h-3.5 w-3.5" />Plataformas</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 text-xs"><Brain className="h-3.5 w-3.5" />IA</TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5 text-xs"><Code className="h-3.5 w-3.5" />API</TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5 text-xs"><Mail className="h-3.5 w-3.5" />E-mail</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="mt-4 space-y-4">
        <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {}}>
          <Plus className="h-3.5 w-3.5" />
          Nova Integração
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => {
          const conn = connections[integration.platform];
          const connected = !!conn?.enabled;
          return (
            <Card
              key={integration.id}
              className={`transition-colors ${!integration.available ? "opacity-50" : "hover:border-primary/30 cursor-pointer"}`}
              onClick={() => integration.available && openConfig(integration)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="shrink-0">{PlatformIcons[integration.platform] || <span className="text-2xl">⚙️</span>}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{integration.name}</span>
                    {connected && (
                      <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-primary/10 text-primary border-primary/20">
                        <Check className="h-3 w-3" /> Conectado
                      </Badge>
                    )}
                    {!integration.available && (
                      <Badge variant="outline" className="text-[10px] h-5">Em breve</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{integration.description}</p>
                </div>
                {integration.available && (
                  <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Meta Ads — multi-account */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {PlatformIcons["meta_ads"]}
            <div>
              <h3 className="text-sm font-medium">Meta Ads</h3>
              <p className="text-xs text-muted-foreground">Gastos com anúncios Meta/Facebook para deduções no relatório</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={openMetaAdd}>
            <Plus className="h-3.5 w-3.5" /> Adicionar Conta
          </Button>
        </div>

        {metaAccounts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conta Meta Ads conectada</p>
        )}

        <div className="space-y-2">
          {metaAccounts.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{acc.label}</span>
                    <Badge variant="outline" className="text-[10px] h-5 font-mono">{acc.ad_account_id}</Badge>
                    {acc.enabled ? (
                      <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-primary/10 text-primary border-primary/20">
                        <Check className="h-3 w-3" /> Ativa
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5">Inativa</Badge>
                    )}
                  </div>
                </div>
                <Switch checked={acc.enabled} onCheckedChange={() => handleMetaToggle(acc)} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMetaEdit(acc)}>
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleMetaDelete(acc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Meta Ads dialog */}
      <Dialog open={metaDialog} onOpenChange={setMetaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {PlatformIcons["meta_ads"]}
              {editingMeta ? "Editar Conta" : "Adicionar Conta Meta Ads"}
            </DialogTitle>
            <DialogDescription>Configure os dados da conta de anúncios</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nome da conta</label>
              <Input
                placeholder="Ex: Conta Principal, Cliente X..."
                value={metaForm.label}
                onChange={(e) => setMetaForm((v) => ({ ...v, label: e.target.value }))}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Access Token (longa duração)</label>
              <div className="relative">
                <Input
                  type={metaShowToken ? "text" : "password"}
                  placeholder="EAAxxxxxxx..."
                  value={metaForm.access_token}
                  onChange={(e) => setMetaForm((v) => ({ ...v, access_token: e.target.value }))}
                  className="text-xs pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setMetaShowToken((v) => !v)}
                >
                  {metaShowToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">ID da Conta de Anúncios</label>
              <Input
                placeholder="act_123456789"
                value={metaForm.ad_account_id}
                onChange={(e) => setMetaForm((v) => ({ ...v, ad_account_id: e.target.value }))}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" className="text-xs" onClick={handleMetaSave} disabled={metaSaving || !metaForm.access_token || !metaForm.ad_account_id}>
              {metaSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              {editingMeta ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!configDialog} onOpenChange={(open) => !open && setConfigDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="shrink-0">{PlatformIcons[configDialog?.platform ?? ""] || <span className="text-xl">⚙️</span>}</div>
              {configDialog?.name}
            </DialogTitle>
            <DialogDescription>{configDialog?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {configDialog?.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-medium">{field.label}</label>
                <div className="relative">
                  <Input
                    type={field.type === "password" && !showSecret[field.key] ? "password" : "text"}
                    placeholder={field.placeholder}
                    value={formValues[field.key] || ""}
                    onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    className="text-xs pr-9"
                  />
                  {field.type === "password" && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSecret((s) => ({ ...s, [field.key]: !s[field.key] }));
                      }}
                    >
                      {showSecret[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {configDialog?.webhookPath && (connections[configDialog.platform] || configDialog.fields.length === 0) && (() => {
              const baseUrl = (workspaceUrl || profile?.app_public_url || "").replace(/\/+$/, "") || "https://SEU-API-DOMAIN";
              const webhookUrl = `${baseUrl}${configDialog.webhookPath}`;
              return (
                <div className="space-y-1.5 pt-2 border-t">
                  <label className="text-xs font-medium">URL do Webhook</label>
                  <p className="text-[11px] text-muted-foreground">
                    Copie e cole esta URL para receber notificações
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={webhookUrl}
                      className="font-mono text-[11px] bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(webhookUrl);
                        toast({ title: "URL do webhook copiada!" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* Mini documentação para Mercado Pago */}
            {configDialog?.id === "mercadopago" && connections[configDialog.platform] && (
              <div className="space-y-3 pt-3 border-t">
                <label className="text-xs font-semibold">📄 Como configurar</label>

                <div className="space-y-1">
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-foreground">
                    <li>Acesse o painel do <strong>Mercado Pago</strong></li>
                    <li>Vá em <strong>Configurações → IPN (Notificações)</strong></li>
                    <li>Cole a URL acima no campo <strong>"URL de notificação"</strong></li>
                    <li>Selecione o evento <strong>"Pagamentos"</strong></li>
                  </ol>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">JSON enviado automaticamente pelo MP</p>
                  <pre className="bg-muted rounded p-2 text-[10px] font-mono whitespace-pre overflow-x-auto">{`{
  "resource": "PAYMENT_ID",
  "topic": "payment"
}`}</pre>
                  <p className="text-[10px] text-muted-foreground">
                    Não é necessário configurar nenhum body manualmente. O Mercado Pago envia a notificação e o sistema busca os detalhes via API.
                  </p>
                </div>
              </div>
            )}

            {/* Mini documentação para Yampi (via n8n) */}
            {configDialog?.id === "yampi" && (
              <div className="space-y-3 pt-3 border-t">
                <label className="text-xs font-semibold">📄 Documentação — Webhook via n8n</label>

                <p className="text-[11px] text-muted-foreground">
                  Configure o n8n para receber os eventos da Yampi e repassar para esta URL com o payload abaixo.
                </p>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Método</p>
                  <code className="block text-[11px] bg-muted rounded px-2 py-1 font-mono">POST</code>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Seu Workspace ID</p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={workspaceId || ""}
                      className="font-mono text-[11px] bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(workspaceId || "");
                        toast({ title: "Workspace ID copiado!" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>


                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Campos obrigatórios</p>
                  <div className="bg-muted rounded p-2 space-y-0.5">
                    <p className="text-[11px] font-mono"><span className="text-primary">event</span> — evento original da Yampi</p>
                    <p className="text-[11px] font-mono"><span className="text-primary">workspace_id</span> — UUID do workspace</p>
                    <p className="text-[11px] font-mono"><span className="text-primary">resource</span> — objeto original da Yampi (com CPF)</p>
                    <p className="text-[11px] font-mono"><span className="text-primary">resource</span> — objeto original da Yampi</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Eventos suportados</p>
                  <div className="bg-muted rounded p-2 space-y-0.5">
                    <p className="text-[11px] font-mono"><span className="text-primary">order.paid</span> → aprovado</p>
                    <p className="text-[11px] font-mono"><span className="text-destructive">transaction.payment.refused</span> → rejeitado</p>
                    <p className="text-[11px] font-mono"><span className="text-accent-foreground">cart.reminder</span> → carrinho abandonado</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Exemplo de payload (configurar no n8n)</p>
                  <pre className="bg-muted rounded p-2 text-[10px] font-mono whitespace-pre overflow-x-auto">{`{
  "event": "order.paid",
  "workspace_id": "${workspaceId || "seu-workspace-id"}",
  "resource": {
    "value_total": 149.90,
    "customer": {
      "data": {
        "name": "João Silva",
        "email": "joao@email.com",
        "phone": { "full_number": "11999998888" },
        "cpf": "12345678900"
      }
    }
  }
}`}</pre>
                  <p className="text-[10px] text-muted-foreground">
                    O campo <code className="text-[10px]">resource</code> deve conter o objeto original que a Yampi envia. No n8n, basta mapear o body inteiro da Yampi para este campo.
                  </p>
                </div>
              </div>
            )}

            {/* Mini documentação para webhook manual */}
            {configDialog?.id === "manual_payment" && (
              <div className="space-y-3 pt-3 border-t">
                <label className="text-xs font-semibold">📄 Documentação</label>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Método</p>
                  <code className="block text-[11px] bg-muted rounded px-2 py-1 font-mono">POST</code>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Seu Workspace ID</p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={workspaceId || ""}
                      className="font-mono text-[11px] bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(workspaceId || "");
                        toast({ title: "Workspace ID copiado!" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Campos obrigatórios</p>
                  <div className="bg-muted rounded p-2 space-y-0.5">
                    <p className="text-[11px] font-mono"><span className="text-primary">workspace_id</span> — UUID do workspace</p>
                    <p className="text-[11px] font-mono"><span className="text-primary">event</span> — evento (ver abaixo)</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Eventos</p>
                  <div className="bg-muted rounded p-2 space-y-0.5">
                    <p className="text-[11px] font-mono"><span className="text-muted-foreground">payment_pending</span> → pendente</p>
                    <p className="text-[11px] font-mono"><span className="text-primary">payment_approved</span> → aprovado</p>
                    <p className="text-[11px] font-mono"><span className="text-destructive">payment_refused</span> → rejeitado</p>
                    <p className="text-[11px] font-mono"><span className="text-accent-foreground">payment_refunded</span> → reembolsado</p>
                    <p className="text-[11px] font-mono"><span className="text-destructive">payment_chargeback</span> → chargeback</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Tipos de pagamento (type)</p>
                  <div className="bg-muted rounded p-2">
                    <p className="text-[11px] font-mono">pix · cartao · boleto</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Default: pix</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Campos opcionais</p>
                  <div className="bg-muted rounded p-2 space-y-0.5">
                    <p className="text-[11px] font-mono">external_id · amount · customer_name</p>
                    <p className="text-[11px] font-mono">customer_email · customer_phone · customer_document</p>
                    <p className="text-[11px] font-mono">description · payment_url · paid_at · metadata</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Exemplo de payload</p>
                  <pre className="bg-muted rounded p-2 text-[10px] font-mono whitespace-pre overflow-x-auto">{`{
  "workspace_id": "${workspaceId || "seu-uuid"}",
  "event": "payment_approved",
  "type": "pix",
  "amount": 149.90,
  "customer_name": "João Silva",
  "customer_phone": "5511999998888"
}`}</pre>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2">
            {connections[configDialog?.platform || ""] && (
              <Button variant="destructive" size="sm" className="text-xs" onClick={handleDisconnect} disabled={saving}>
                Desconectar
              </Button>
            )}
            <div className="flex-1" />
            <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AISection />
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <IntegrationApiSection />
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <EmailSettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
