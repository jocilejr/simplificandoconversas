import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Check, Settings2, Loader2, Eye, EyeOff, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PlatformIcons: Record<string, React.ReactNode> = {
  mercadopago: (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#009ee3"><path d="M11.115 16.479a.93.927 0 0 1-.939-.886c-.002-.042-.006-.155-.103-.155-.04 0-.074.023-.113.059-.112.103-.254.206-.46.206a.816.814 0 0 1-.305-.066c-.535-.214-.542-.578-.521-.725.006-.038.007-.08-.02-.11l-.032-.03h-.034c-.027 0-.055.012-.093.039a.788.786 0 0 1-.454.16.7.699 0 0 1-.253-.05c-.708-.27-.65-.928-.617-1.126.005-.041-.005-.072-.03-.092l-.05-.04-.047.043a.728.726 0 0 1-.505.203.73.728 0 0 1-.732-.725c0-.4.328-.722.732-.722.364 0 .675.27.721.63l.026.195.11-.165c.01-.018.307-.46.852-.46.102 0 .21.016.316.05.434.13.508.52.519.68.008.094.075.1.09.1.037 0 .064-.024.083-.045a.746.744 0 0 1 .54-.225c.128 0 .263.03.402.09.69.293.379 1.158.374 1.167-.058.144-.061.207-.005.244l.027.013h.02c.03 0 .07-.014.134-.035.093-.032.235-.08.367-.08a.944.942 0 0 1 .94.93.936.934 0 0 1-.94.928zm7.302-4.171c-1.138-.98-3.768-3.24-4.481-3.77-.406-.302-.685-.462-.928-.533a1.559 1.554 0 0 0-.456-.07c-.182 0-.376.032-.58.095-.46.145-.918.505-1.362.854l-.023.018c-.414.324-.84.66-1.164.73a1.986 1.98 0 0 1-.43.049c-.362 0-.687-.104-.81-.258-.02-.025-.007-.066.04-.125l.008-.008 1-1.067c.783-.774 1.525-1.506 3.23-1.545h.085c1.062 0 2.12.469 2.24.524a7.03 7.03 0 0 0 3.056.724c1.076 0 2.188-.263 3.354-.795a9.135 9.11 0 0 0-.405-.317c-1.025.44-2.003.66-2.946.66-.962 0-1.925-.229-2.858-.68-.05-.022-1.22-.567-2.44-.57-.032 0-.065 0-.096.002-1.434.033-2.24.536-2.782.976-.528.013-.982.138-1.388.25-.361.1-.673.186-.979.185-.125 0-.35-.01-.37-.012-.35-.01-2.115-.437-3.518-.962-.143.1-.28.203-.415.31 1.466.593 3.25 1.053 3.812 1.089.157.01.323.027.491.027.372 0 .744-.103 1.104-.203.213-.059.446-.123.692-.17l-.196.194-1.017 1.087c-.08.08-.254.294-.14.557a.705.703 0 0 0 .268.292c.243.162.677.27 1.08.271.152 0 .297-.015.43-.044.427-.095.874-.448 1.349-.82.377-.296.913-.672 1.323-.782a1.494 1.49 0 0 1 .37-.05.611.61 0 0 1 .095.005c.27.034.533.125 1.003.472.835.62 4.531 3.815 4.566 3.846.002.002.238.203.22.537-.007.186-.11.352-.294.466a.902.9 0 0 1-.484.15.804.802 0 0 1-.428-.124c-.014-.01-1.28-1.157-1.746-1.543-.074-.06-.146-.115-.22-.115a.122.122 0 0 0-.096.045c-.073.09.01.212.105.294l1.48 1.47c.002 0 .184.17.204.395.012.244-.106.447-.35.606a.957.955 0 0 1-.526.171.766.764 0 0 1-.42-.127l-.214-.206a21.035 20.978 0 0 0-1.08-1.009c-.072-.058-.148-.112-.221-.112a.127.127 0 0 0-.094.038c-.033.037-.056.103.028.212a.698.696 0 0 0 .075.083l1.078 1.198c.01.01.222.26.024.511l-.038.048a1.18 1.178 0 0 1-.1.096c-.184.15-.43.164-.527.164a.8.798 0 0 1-.147-.012c-.106-.018-.178-.048-.212-.089l-.013-.013c-.06-.06-.602-.609-1.054-.98-.059-.05-.133-.11-.21-.11a.128.128 0 0 0-.096.042c-.09.096.044.24.1.293l.92 1.003a.204.204 0 0 1-.033.062c-.033.044-.144.155-.479.196a.91.907 0 0 1-.122.007c-.345 0-.712-.164-.902-.264a1.343 1.34 0 0 0 .13-.576 1.368 1.365 0 0 0-1.42-1.357c.024-.342-.025-.99-.697-1.274a1.455 1.452 0 0 0-.575-.125c-.146 0-.287.025-.42.075a1.153 1.15 0 0 0-.671-.564 1.52 1.515 0 0 0-.494-.085c-.28 0-.537.08-.767.242a1.168 1.165 0 0 0-.903-.43 1.173 1.17 0 0 0-.82.335c-.287-.217-1.425-.93-4.467-1.613a17.39 17.344 0 0 1-.692-.189 4.822 4.82 0 0 0-.077.494l.67.157c3.108.682 4.136 1.391 4.309 1.525a1.145 1.142 0 0 0-.09.442 1.16 1.158 0 0 0 1.378 1.132c.096.467.406.821.879 1.003a1.165 1.162 0 0 0 .415.08c.09 0 .179-.012.266-.034.086.22.282.493.722.668a1.233 1.23 0 0 0 .457.094c.122 0 .241-.022.355-.063a1.373 1.37 0 0 0 1.269.841c.37.002.726-.147.985-.41.221.121.688.341 1.163.341.06 0 .118-.002.175-.01.47-.059.689-.24.789-.382a.571.57 0 0 0 .048-.078c.11.032.234.058.373.058.255 0 .501-.086.75-.265.244-.174.418-.424.444-.637v-.01c.083.017.167.026.251.026.265 0 .527-.082.773-.242.48-.31.562-.715.554-.98a1.28 1.279 0 0 0 .978-.194 1.04 1.04 0 0 0 .502-.808 1.088 1.085 0 0 0-.16-.653c.804-.342 2.636-1.003 4.795-1.483a4.734 4.721 0 0 0-.067-.492 27.742 27.667 0 0 0-5.049 1.62zm5.123-.763c0 4.027-5.166 7.293-11.537 7.293-6.372 0-11.538-3.266-11.538-7.293 0-4.028 5.165-7.293 11.539-7.293 6.371 0 11.537 3.265 11.537 7.293zm.46.004c0-4.272-5.374-7.755-12-7.755S.002 7.277.002 11.55L0 12.004c0 4.533 4.695 8.203 11.999 8.203 7.347 0 12-3.67 12-8.204z"/></svg>
  ),
  openpix: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><circle cx="24" cy="24" r="24" fill="#03d69d"/><text x="24" y="30" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold" fontFamily="sans-serif">W</text></svg>
  ),
  yampi: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="10" fill="#7c3aed"/><text x="24" y="32" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="bold" fontFamily="sans-serif">Y</text></svg>
  ),
  manual_payment: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="10" fill="#6b7280"/><path d="M15 20h18v2H15zm0 6h18v2H15zM24 14v20" stroke="#fff" strokeWidth="2" fill="none"/><circle cx="24" cy="14" r="2" fill="#fff"/><circle cx="24" cy="34" r="2" fill="#fff"/></svg>
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
  {
    id: "meta_ads",
    name: "Meta Ads",
    description: "Gastos com anúncios Meta/Facebook para deduções no relatório",
    platform: "meta_ads",
    icon: "",
    available: true,
    fields: [
      { key: "access_token", label: "Access Token (longa duração)", placeholder: "EAAxxxxxxx...", type: "password" },
      { key: "ad_account_id", label: "ID da Conta de Anúncios", placeholder: "act_123456789" },
    ],
  },
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
  {
    id: "openai",
    name: "OpenAI",
    description: "Inteligência artificial",
    platform: "openai",
    icon: "",
    available: false,
    fields: [],
  },
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

  useEffect(() => {
    if (!user || !workspaceId) return;
    loadConnections();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Integrações</h2>
          <p className="text-xs text-muted-foreground">Conecte serviços externos à plataforma</p>
        </div>
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
    </div>
  );
}
