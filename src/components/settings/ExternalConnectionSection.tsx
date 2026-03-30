import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Save, Loader2, CheckCircle2, XCircle, RefreshCw, Unplug } from "lucide-react";

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
      toast({ title: "Informe a URL base da aplicação externa", variant: "destructive" });
      return;
    }
    setTesting(true);
    setConnectionStatus("idle");
    try {
      const url = `${baseUrl.replace(/\/+$/, "")}/api/health`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["X-API-Key"] = apiKey;

      const res = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        setConnectionStatus("success");
        toast({ title: "Conexão bem-sucedida!", description: `Resposta ${res.status} de ${url}` });
      } else {
        setConnectionStatus("error");
        toast({ title: "Falha na conexão", description: `Resposta ${res.status}`, variant: "destructive" });
      }
    } catch (err: any) {
      setConnectionStatus("error");
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Unplug className="h-5 w-5" />
                Conexão com App Externa
              </CardTitle>
              <CardDescription>
                Configure a conexão com sua plataforma de gestão para sincronização bidirecional
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
            <Label>URL Base da Aplicação Externa</Label>
            <Input
              placeholder="https://minha-gestao.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Endereço base da API da outra aplicação (ex: <code className="bg-muted px-1 rounded">https://gestao.empresa.com</code>)
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
            <Label>Webhook URL (callback para sua app)</Label>
            <Input
              placeholder="https://minha-vps.com/api/external-messaging-webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL que a app externa deve chamar para enviar eventos de volta (lembretes atualizados, pagamentos, etc.)
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

      {/* Info card about what this connection enables */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <h4 className="text-sm font-medium mb-2">O que esta conexão habilita:</h4>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">→</span>
              <span><strong>Saída:</strong> Toda alteração aqui (criar/editar/deletar lembretes, transações, contatos, tags) envia um webhook para a app externa</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">←</span>
              <span><strong>Entrada:</strong> A app externa pode chamar sua API REST para consultar e alterar dados, ou enviar webhooks com atualizações</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-0.5">⟷</span>
              <span><strong>Bidirecional:</strong> Ambas as aplicações ficam sincronizadas em tempo real</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
