import { useState, useEffect } from "react";
import { usePlatformConnections } from "@/hooks/usePlatformConnections";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Loader2, Unplug, Save, CreditCard } from "lucide-react";
import { toast } from "sonner";

function OpenPixCard() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { getConnection, upsertConnection, deleteConnection } = usePlatformConnections();

  const connection = getConnection("openpix");
  const isConnected = !!connection?.enabled && !!connection?.credentials?.app_id;

  const [appId, setAppId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (connection) {
      setAppId(connection.credentials?.app_id || "");
      setWebhookSecret(connection.credentials?.webhook_secret || "");
    }
  }, [connection]);

  const [baseUrl, setBaseUrl] = useState(profile?.app_public_url || "");

  useEffect(() => {
    if (profile?.app_public_url) {
      setBaseUrl(profile.app_public_url);
    }
  }, [profile?.app_public_url]);

  const webhookUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/api/webhook-transactions/openpix${user?.id ? `?user_id=${user.id}` : ""}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!appId.trim()) {
      toast.error("Preencha o App ID");
      return;
    }
    upsertConnection.mutate({
      platform: "openpix",
      credentials: { app_id: appId.trim(), webhook_secret: webhookSecret.trim() },
      enabled: true,
    });
  };

  const handleDisconnect = () => {
    deleteConnection.mutate("openpix");
    setAppId("");
    setWebhookSecret("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <CreditCard className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-lg">OpenPix</CardTitle>
            <CardDescription>Receba notificações de cobranças Pix</CardDescription>
          </div>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"}>
          {isConnected ? "Conectada" : "Desconectada"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="openpix-appid">App ID</Label>
          <Input
            id="openpix-appid"
            placeholder="Seu App ID da OpenPix"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="openpix-secret">Webhook Secret (opcional)</Label>
          <Input
            id="openpix-secret"
            type="password"
            placeholder="Secret para validação do webhook"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="openpix-baseurl">URL base da sua API (VPS)</Label>
          <Input
            id="openpix-baseurl"
            placeholder="https://api.seudominio.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Insira a URL pública da sua VPS (ex: https://api.meusite.com)
          </p>
        </div>

        <div className="space-y-2">
          <Label>URL do Webhook</Label>
          <p className="text-xs text-muted-foreground">
            Configure esta URL no painel da OpenPix para receber notificações
          </p>
          {webhookUrl ? (
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-destructive">Preencha a URL base acima para gerar o webhook</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={upsertConnection.isPending}>
            {upsertConnection.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
          {isConnected && (
            <Button variant="destructive" onClick={handleDisconnect} disabled={deleteConnection.isPending}>
              {deleteConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Unplug className="h-4 w-4 mr-2" />
              )}
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ComingSoonCard({ name, description }: { name: string; description: string }) {
  return (
    <Card className="opacity-60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">{name}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Badge variant="outline">Em breve</Badge>
      </CardHeader>
    </Card>
  );
}

export function IntegrationsSection() {
  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">
        Conecte suas plataformas de pagamento para receber transações automaticamente via webhook.
      </p>
      <OpenPixCard />
      <ComingSoonCard name="Mercado Pago" description="Receba pagamentos via Pix, cartão e boleto" />
      <ComingSoonCard name="Yampi" description="Integração com checkout e pedidos" />
    </div>
  );
}
