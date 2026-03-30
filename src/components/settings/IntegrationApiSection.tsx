import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function IntegrationApiSection() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);

  useEffect(() => {
    loadKey();
  }, []);

  async function loadKey() {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("platform_connections")
        .select("credentials, enabled")
        .eq("platform", "custom_api")
        .maybeSingle();

      if (data?.credentials?.api_key) {
        setApiKey(data.credentials.api_key);
      }
      if (data?.credentials?.webhook_url) {
        setWebhookUrl(data.credentials.webhook_url);
      }
    } catch (err) {
      console.error("Error loading API key:", err);
    } finally {
      setLoading(false);
    }
  }

  async function generateKey() {
    setGenerating(true);
    try {
      const newKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await (supabase as any)
        .from("platform_connections")
        .select("id")
        .eq("platform", "custom_api")
        .maybeSingle();

      if (existing) {
        await (supabase as any)
          .from("platform_connections")
          .update({ credentials: { api_key: newKey }, enabled: true })
          .eq("id", existing.id);
      } else {
        await (supabase as any)
          .from("platform_connections")
          .insert({
            user_id: user.id,
            platform: "custom_api",
            credentials: { api_key: newKey },
            enabled: true,
          });
      }

      setApiKey(newKey);
      toast({ title: "API Key gerada com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao gerar API Key", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    toast({ title: "API Key copiada!" });
  }

  const maskedKey = apiKey ? apiKey.substring(0, 8) + "••••••••••••••••" + apiKey.substring(apiKey.length - 8) : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>API de Integração (Sua API Pública)</CardTitle>
        <CardDescription>
          Endpoints que a aplicação externa deve consumir para se integrar ao seu sistema via VPS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : apiKey ? (
            <div className="flex gap-2">
              <Input
                readOnly
                value={showKey ? apiKey : maskedKey}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={copyKey}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={generateKey} disabled={generating}>
                <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
              </Button>
            </div>
          ) : (
            <Button onClick={generateKey} disabled={generating}>
              {generating ? "Gerando..." : "Gerar API Key"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            A app externa deve enviar esta key no header <code className="bg-muted px-1 rounded">X-API-Key</code> em cada requisição.
          </p>
        </div>

        {/* Webhook URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Webhook URL (receber eventos da app externa)</label>
          <p className="text-xs text-muted-foreground">
            Quando um lembrete for atualizado aqui, enviaremos um POST para esta URL.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://gestao.empresa.com/api/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={savingWebhook}
              onClick={async () => {
                setSavingWebhook(true);
                try {
                  const { data: existing } = await (supabase as any)
                    .from("platform_connections")
                    .select("id, credentials")
                    .eq("platform", "custom_api")
                    .maybeSingle();

                  if (existing) {
                    await (supabase as any)
                      .from("platform_connections")
                      .update({ credentials: { ...existing.credentials, webhook_url: webhookUrl } })
                      .eq("id", existing.id);
                  } else {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error("Not authenticated");
                    await (supabase as any)
                      .from("platform_connections")
                      .insert({
                        user_id: user.id,
                        platform: "custom_api",
                        credentials: { webhook_url: webhookUrl },
                        enabled: true,
                      });
                  }
                  toast({ title: "Webhook URL salva!" });
                } catch (err: any) {
                  toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
                } finally {
                  setSavingWebhook(false);
                }
              }}
            >
              {savingWebhook ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {/* Endpoints documentation */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Endpoints Disponíveis (VPS)</label>
          <p className="text-xs text-muted-foreground">
            Substitua <code className="bg-muted px-1 rounded">SEU-API-DOMAIN</code> pelo domínio da sua VPS.
          </p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="health">
            <AccordionTrigger className="text-sm">Health / Ping</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-xs font-mono">
                <div><span className="text-green-500">GET</span> https://SEU-API-DOMAIN/api/platform/ping</div>
                <div className="text-muted-foreground">Retorna {"{ ok: true, service: 'platform-api' }"} — use para testar conectividade</div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="contacts">
            <AccordionTrigger className="text-sm">Contatos / Clientes</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-xs font-mono">
                <div><span className="text-green-500">GET</span> https://SEU-API-DOMAIN/api/platform/contacts<span className="text-muted-foreground ml-2">?phone=&name=&instance=&limit=&offset=</span></div>
                <div><span className="text-green-500">GET</span> https://SEU-API-DOMAIN/api/platform/contacts/:phone</div>
                <div><span className="text-blue-500">POST</span> https://SEU-API-DOMAIN/api/platform/contacts <span className="text-muted-foreground">{"{ phone, name, instance_name }"}</span></div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="transactions">
            <AccordionTrigger className="text-sm">Transações / Pagamentos</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-xs font-mono">
                <div><span className="text-green-500">GET</span> https://SEU-API-DOMAIN/api/platform/transactions<span className="text-muted-foreground ml-2">?status=&from=&to=&phone=</span></div>
                <div><span className="text-blue-500">POST</span> https://SEU-API-DOMAIN/api/platform/transactions <span className="text-muted-foreground">{"{ amount, type, status, customer_name, customer_phone, ... }"}</span></div>
                <div><span className="text-yellow-500">PATCH</span> https://SEU-API-DOMAIN/api/platform/transactions/:id <span className="text-muted-foreground">{"{ status, paid_at, metadata }"}</span></div>
                <div><span className="text-blue-500">POST</span> https://SEU-API-DOMAIN/api/platform/transactions/webhook <span className="text-muted-foreground">{"{ external_id, status, paid_at }"}</span></div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tags">
            <AccordionTrigger className="text-sm">Tags / Segmentação</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-xs font-mono">
                <div><span className="text-green-500">GET</span> https://SEU-API-DOMAIN/api/platform/tags?phone=X</div>
                <div><span className="text-blue-500">POST</span> https://SEU-API-DOMAIN/api/platform/tags <span className="text-muted-foreground">{"{ phone, tag_name }"}</span></div>
                <div><span className="text-red-500">DELETE</span> https://SEU-API-DOMAIN/api/platform/tags <span className="text-muted-foreground">{"{ phone, tag_name }"}</span></div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reminders">
            <AccordionTrigger className="text-sm">Lembretes</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-xs font-mono">
                <div><span className="text-green-500">GET</span> https://SEU-API-DOMAIN/api/platform/reminders<span className="text-muted-foreground ml-2">?filter=pending|overdue|today|completed&phone=</span></div>
                <div><span className="text-blue-500">POST</span> https://SEU-API-DOMAIN/api/platform/reminders <span className="text-muted-foreground">{"{ phone, title, description, due_date }"}</span></div>
                <div><span className="text-yellow-500">PATCH</span> https://SEU-API-DOMAIN/api/platform/reminders/:id <span className="text-muted-foreground">{"{ completed, title, due_date }"}</span></div>
                <div><span className="text-red-500">DELETE</span> https://SEU-API-DOMAIN/api/platform/reminders/:id</div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="webhook-entrada">
            <AccordionTrigger className="text-sm">Webhook de Entrada</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-xs font-mono">
                <div><span className="text-blue-500">POST</span> https://SEU-API-DOMAIN/api/external-messaging-webhook</div>
                <div className="text-muted-foreground">
                  Payload: {"{ event: 'reminder_updated|payment_received|...', data: { ... } }"}
                </div>
                <div className="text-muted-foreground">
                  Header: X-API-Key: SUA_CHAVE
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
