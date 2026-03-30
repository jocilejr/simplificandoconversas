import { useState, useEffect } from "react";
import { usePlatformConnections, PlatformConnection } from "@/hooks/usePlatformConnections";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Loader2, Plus, Pencil, Trash2, CreditCard, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface PlatformConfig {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  fields: { key: string; label: string; placeholder: string; type?: string; required?: boolean }[];
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: "openpix",
    name: "OpenPix",
    description: "Receba notificações de cobranças Pix",
    icon: <CreditCard className="h-5 w-5 text-emerald-500" />,
    colorClass: "bg-emerald-500/10",
    fields: [
      { key: "app_id", label: "App ID", placeholder: "Seu App ID da OpenPix", required: true },
      { key: "webhook_secret", label: "Webhook Secret", placeholder: "Secret para validação (opcional)", type: "password" },
    ],
  },
  {
    key: "mercadopago",
    name: "Mercado Pago",
    description: "Receba pagamentos via Pix, cartão e boleto",
    icon: <ShoppingCart className="h-5 w-5 text-blue-500" />,
    colorClass: "bg-blue-500/10",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "Seu Access Token do Mercado Pago", type: "password", required: true },
    ],
  },
  {
    key: "yampi",
    name: "Yampi",
    description: "Integração com checkout e pedidos",
    icon: <Package className="h-5 w-5 text-purple-500" />,
    colorClass: "bg-purple-500/10",
    fields: [
      { key: "api_token", label: "API Token", placeholder: "Seu Token da API Yampi", type: "password", required: true },
      { key: "alias", label: "Alias da Loja", placeholder: "Ex: minha-loja" },
    ],
  },
];

function getPlatformConfig(key: string) {
  return PLATFORMS.find((p) => p.key === key);
}

function ConnectionCard({
  connection,
  onEdit,
  onDelete,
  onToggle,
  webhookUrl,
}: {
  connection: PlatformConnection;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  webhookUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const config = getPlatformConfig(connection.platform);
  if (!config) return null;

  const handleCopy = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.colorClass}`}>
            {config.icon}
          </div>
          <div>
            <CardTitle className="text-lg">{config.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={connection.enabled ? "default" : "secondary"}>
            {connection.enabled ? "Ativa" : "Inativa"}
          </Badge>
          <Switch checked={!!connection.enabled} onCheckedChange={onToggle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
          {webhookUrl ? (
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-destructive">
              Configure a URL pública na aba "Aplicação" para gerar o webhook
            </p>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Editar
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationsSection() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { connections, upsertConnection, deleteConnection } = usePlatformConnections();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const baseUrl = profile?.app_public_url?.replace(/\/$/, "") || "";

  const buildWebhookUrl = (platform: string) =>
    baseUrl ? `${baseUrl}/api/webhook-transactions/${platform}${user?.id ? `?user_id=${user.id}` : ""}` : "";

  const availablePlatforms = PLATFORMS.filter(
    (p) => !connections.some((c) => c.platform === p.key) || editingPlatform === p.key
  );

  const openNewDialog = () => {
    setEditingPlatform(null);
    setSelectedPlatform("");
    setCredentials({});
    setDialogOpen(true);
  };

  const openEditDialog = (conn: PlatformConnection) => {
    setEditingPlatform(conn.platform);
    setSelectedPlatform(conn.platform);
    setCredentials(conn.credentials as Record<string, string>);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const config = getPlatformConfig(selectedPlatform);
    if (!config) return;

    const missingRequired = config.fields.filter((f) => f.required && !credentials[f.key]?.trim());
    if (missingRequired.length > 0) {
      toast.error(`Preencha: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    upsertConnection.mutate(
      { platform: selectedPlatform, credentials, enabled: true },
      { onSuccess: () => setDialogOpen(false) }
    );
  };

  const handleDelete = (platform: string) => {
    deleteConnection.mutate(platform);
  };

  const handleToggle = (conn: PlatformConnection, enabled: boolean) => {
    upsertConnection.mutate({
      platform: conn.platform,
      credentials: conn.credentials as Record<string, string>,
      enabled,
    });
  };

  const currentFields = getPlatformConfig(selectedPlatform)?.fields || [];

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Conecte suas plataformas de pagamento para receber transações via webhook.
        </p>
        <Button onClick={openNewDialog} disabled={availablePlatforms.length === 0 && !editingPlatform}>
          <Plus className="h-4 w-4 mr-2" /> Nova Integração
        </Button>
      </div>

      {!baseUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Configure a <strong>URL pública da aplicação</strong> na aba "Aplicação" para que os webhooks sejam gerados automaticamente.
          </span>
        </div>
      )}

      {connections.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <CreditCard className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhuma integração configurada</p>
            <p className="text-xs">Clique em "Nova Integração" para começar</p>
          </CardContent>
        </Card>
      )}

      {connections.map((conn) => (
        <ConnectionCard
          key={conn.id}
          connection={conn}
          webhookUrl={buildWebhookUrl(conn.platform)}
          onEdit={() => openEditDialog(conn)}
          onDelete={() => handleDelete(conn.platform)}
          onToggle={(enabled) => handleToggle(conn, enabled)}
        />
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlatform ? "Editar Integração" : "Nova Integração"}</DialogTitle>
            <DialogDescription>
              {editingPlatform
                ? "Atualize as credenciais da plataforma."
                : "Selecione a plataforma e preencha as credenciais."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select
                value={selectedPlatform}
                onValueChange={(v) => {
                  setSelectedPlatform(v);
                  if (!editingPlatform) setCredentials({});
                }}
                disabled={!!editingPlatform}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {(editingPlatform ? PLATFORMS : availablePlatforms).map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  value={credentials[field.key] || ""}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!selectedPlatform || upsertConnection.isPending}>
              {upsertConnection.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
