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
    <svg viewBox="0 0 48 48" className="h-7 w-7"><circle cx="24" cy="24" r="24" fill="#009ee3"/><path d="M34.3 19.5c-.6-2.7-3-4.5-6.3-4.5-2.1 0-4 .9-5 2.4-1-1.5-2.9-2.4-5-2.4-3.3 0-5.7 1.8-6.3 4.5-.8 3.6 1.2 8.1 5.7 12.3 1.4 1.3 3.4 2.7 5.6 2.7s4.2-1.4 5.6-2.7c4.5-4.2 6.5-8.7 5.7-12.3z" fill="#fff"/></svg>
  ),
  openpix: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><circle cx="24" cy="24" r="24" fill="#03d69d"/><path d="M14 24l6-6 4 4 6-6 4 4-10 10-4-4z" fill="#fff"/><circle cx="34" cy="16" r="3" fill="#fff"/></svg>
  ),
  yampi: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="12" fill="#7c3aed"/><path d="M14 18l5 12h2l3-7 3 7h2l5-12h-3l-3.5 8.5L24 19l-3.5 8.5L17 18z" fill="#fff"/></svg>
  ),
  manual_payment: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="12" fill="#6b7280"/><path d="M15 20h18v2H15zM15 26h18v2H15zM24 14v20" stroke="#fff" strokeWidth="2" fill="none"/><circle cx="24" cy="14" r="2" fill="#fff"/><circle cx="24" cy="34" r="2" fill="#fff"/></svg>
  ),
  stripe: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="12" fill="#635bff"/><path d="M22.2 19.8c0-1 .8-1.4 2.1-1.4 1.9 0 4.3.6 6.2 1.6V14.5c-2.1-.8-4.1-1.2-6.2-1.2-5.1 0-8.4 2.6-8.4 7 0 6.8 9.4 5.7 9.4 8.7 0 1.2-1 1.6-2.4 1.6-2.1 0-4.7-.8-6.8-2v5.6c2.3 1 4.6 1.4 6.8 1.4 5.2 0 8.7-2.6 8.7-7 0-7.3-9.4-6-9.4-8.8z" fill="#fff"/></svg>
  ),
  meta_ads: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="12" fill="#1877f2"/><path d="M35 24c0-6.1-4.9-11-11-11s-11 4.9-11 11c0 5.5 4 10 9.2 10.9v-7.7h-2.8V24h2.8v-2.4c0-2.7 1.6-4.2 4.1-4.2 1.2 0 2.4.2 2.4.2v2.7h-1.4c-1.3 0-1.8.8-1.8 1.7V24h3l-.5 3.2h-2.5v7.7C31 34 35 29.5 35 24z" fill="#fff"/></svg>
  ),
  pagbank: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="12" fill="#00a94f"/><path d="M14 20h6v8h-6zM22 16h4v16h-4zM28 22h6v6h-6z" fill="#fff"/></svg>
  ),
  asaas: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="12" fill="#0066ff"/><path d="M16 30l4-12h3l4 8 4-8h3l4 12h-3l-2.8-8.5L29 30h-2l-4.2-8.5L20 30z" fill="#fff"/></svg>
  ),
  openai: (
    <svg viewBox="0 0 48 48" className="h-7 w-7"><rect width="48" height="48" rx="12" fill="#0a0a0a"/><path d="M33.6 21.4c.5-1.5.3-3.2-.6-4.5-1.4-2-3.9-2.9-6.3-2.3-.9-1.1-2.2-1.8-3.7-1.8-2.4 0-4.5 1.6-5.1 3.9-1.6.3-2.9 1.3-3.5 2.8-.9 2.2-.1 4.7 1.8 6.1-.5 1.5-.3 3.2.6 4.5 1.4 2 3.9 2.9 6.3 2.3.9 1.1 2.2 1.8 3.7 1.8 2.4 0 4.5-1.6 5.1-3.9 1.6-.3 2.9-1.3 3.5-2.8.9-2.2.1-4.7-1.8-6.1zM24 30.5c-3.6 0-6.5-2.9-6.5-6.5s2.9-6.5 6.5-6.5 6.5 2.9 6.5 6.5-2.9 6.5-6.5 6.5z" fill="#fff"/></svg>
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
