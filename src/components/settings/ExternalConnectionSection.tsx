import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Save, Loader2, CheckCircle2, XCircle, RefreshCw, Unplug, ArrowRightLeft } from "lucide-react";

export function ExternalConnectionSection() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("platform_connections")
        .select("credentials")
        .eq("platform", "external_app")
        .maybeSingle();

      if (data?.credentials) {
        setBaseUrl(data.credentials.base_url || "");
        setApiKey(data.credentials.api_key || "");
        setWebhookUrl(data.credentials.webhook_url || "");
      }
    } catch (err) {
      console.error("Error loading external connection:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const credentials = {
        base_url: baseUrl.replace(/\/+$/, ""),
        api_key: apiKey,
        webhook_url: webhookUrl,
      };

      const { data: existing } = await (supabase as any)
        .from("platform_connections")
        .select("id")
        .eq("platform", "external_app")
        .maybeSingle();

      if (existing) {
        await (supabase as any)
          .from("platform_connections")
          .update({ credentials, enabled: true })
          .eq("id", existing.id);
      } else {
        await (supabase as any)
          .from("platform_connections")
          .insert({
            user_id: user.id,
            platform: "external_app",
            credentials,
            enabled: true,
          });
      }

      toast({ title: "Conexão salva com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!baseUrl) {
      toast({ title: "Informe a URL base da API externa", variant: "destructive" });
      return;
    }
    setTesting(true);
    setConnectionStatus("idle");
    try {
      const cleanUrl = baseUrl.replace(/\/+$/, "");
      const pingUrl = `${cleanUrl}/ping`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["X-API-Key"] = apiKey;

      const res = await fetch(pingUrl, { method: "GET", headers, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        setConnectionStatus("success");
        toast({ title: "Conexão bem-sucedida!", description: `Resposta ${res.status} de ${pingUrl}` });
      } else {
        setConnectionStatus("error");
        toast({
          title: "Falha na conexão",
          description: `Status ${res.status} em ${pingUrl}. Verifique se a URL base está correta e se o endpoint /ping existe na app externa.`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setConnectionStatus("error");
      toast({
        title: "Erro ao conectar",
        description: `${err.message}. Verifique se o servidor está acessível e se não há bloqueio de CORS.`,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  }

  const maskedKey = apiKey ? apiKey.substring(0, 6) + "••••••••" + apiKey.substring(apiKey.length - 4) : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Conexão de SAÍDA: sua app → app externa */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Conexão com App Externa (Saída)
              </CardTitle>
              <CardDescription>
                Configure a URL e credenciais da API da outra aplicação para que seu sistema se conecte a ela
              </CardDescription>
            </div>
            {connectionStatus === "success" && (
              <Badge className="bg-green-500/15 text-green-500 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Conectada
              </Badge>
            )}
            {connectionStatus === "error" && (
              <Badge variant="destructive" className="bg-red-500/15 text-red-500 border-red-500/30">
                <XCircle className="h-3 w-3 mr-1" /> Falha
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Base URL */}
          <div className="space-y-2">
            <Label>URL Base da API Externa</Label>
            <Input
              placeholder="https://minha-gestao.com/api/platform"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Endereço base da API da outra aplicação. Exemplos para VPS:
            </p>
            <ul className="text-xs text-muted-foreground ml-4 space-y-0.5 list-disc">
              <li><code className="bg-muted px-1 rounded">https://gestao.empresa.com/api/platform</code></li>
              <li><code className="bg-muted px-1 rounded">https://app.meudominio.com/api</code></li>
            </ul>
            <p className="text-xs text-muted-foreground">
              O teste de conexão vai chamar <code className="bg-muted px-1 rounded">{"{URL_BASE}/ping"}</code>
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key da App Externa</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Cole a API Key fornecida pela outra aplicação"
                value={showKey ? apiKey : (apiKey ? maskedKey : "")}
                onChange={(e) => {
                  setShowKey(true);
                  setApiKey(e.target.value);
                }}
              />
              <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Será enviada no header <code className="bg-muted px-1 rounded">X-API-Key</code> em cada requisição para a app externa
            </p>
          </div>

          {/* Webhook URL (callback da app externa para cá) */}
          <div className="space-y-2">
            <Label>Webhook URL de Saída</Label>
            <Input
              placeholder="https://gestao.empresa.com/api/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL da app externa que receberá notificações quando dados forem alterados aqui (lembretes, transações, contatos, etc.)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Conexão
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !baseUrl}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conexão de ENTRADA: app externa → sua app */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Unplug className="h-4 w-4" />
            Sua API Pública (Entrada)
          </CardTitle>
          <CardDescription>
            Endpoints que a app externa deve utilizar para se conectar ao seu sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Configure na app externa os seguintes endpoints da sua VPS:</p>
            <div className="bg-muted rounded-md p-3 space-y-1.5 text-xs font-mono">
              <div><span className="text-green-500">API Base:</span> https://SEU-API-DOMAIN/api/platform</div>
              <div><span className="text-blue-500">Webhook:</span> https://SEU-API-DOMAIN/api/external-messaging-webhook</div>
              <div><span className="text-yellow-500">Health:</span> https://SEU-API-DOMAIN/api/platform/ping</div>
            </div>
            <p className="text-xs text-muted-foreground">
              A API Key para autenticação é gerada na aba <strong>"Integração API"</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <h4 className="text-sm font-medium mb-2">Como funciona a integração bidirecional:</h4>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">→</span>
              <span><strong>Saída (você → externa):</strong> Alterações aqui (lembretes, transações, contatos, tags) disparam um webhook para a URL configurada acima</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">←</span>
              <span><strong>Entrada (externa → você):</strong> A app externa chama seus endpoints REST ou envia webhooks para <code className="bg-muted px-1 rounded">/api/external-messaging-webhook</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-0.5">⟷</span>
              <span><strong>Bidirecional:</strong> Ambas ficam sincronizadas — qualquer mudança em um lado é refletida no outro</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
