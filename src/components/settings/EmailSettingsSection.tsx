import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SmtpSection } from "@/components/settings/SmtpSection";
import { Copy, Webhook, Server, Key, Loader2 } from "lucide-react";
import { format } from "date-fns";

const EVENTS_DOC = [
  { event: "send_email", desc: "Dispara envio de e-mail individual", fields: "to, subject, html, templateId?, recipientName?" },
  { event: "trigger_campaign", desc: "Inicia envio de uma campanha existente", fields: "campaignId" },
  { event: "add_to_campaign", desc: "Adiciona contato aos follow-ups de uma campanha", fields: "campaignId, email, name?" },
];

export function EmailSettingsSection() {
  const { toast } = useToast();

  const { data: apiKey } = useQuery({
    queryKey: ["platform-api-key"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("platform_connections")
        .select("credentials")
        .eq("user_id", user.id)
        .eq("platform", "integration_api")
        .maybeSingle();
      return (data?.credentials as any)?.api_key || null;
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["email-webhook-logs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("api_request_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("path", "/api/email/webhook/inbound")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const webhookUrl = `${window.location.origin}/api/email/webhook/inbound`;

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="smtp" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="smtp" className="gap-1.5">
            <Server className="h-3.5 w-3.5" /> Servidores SMTP
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Webhook className="h-3.5 w-3.5" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="apikey" className="gap-1.5">
            <Key className="h-3.5 w-3.5" /> Chave de API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smtp" className="mt-4">
          <SmtpSection />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4 space-y-4">
          {/* Webhook endpoint */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" /> Endpoint de Webhook
              </CardTitle>
              <CardDescription>
                Receba eventos externos para disparar e-mails automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border font-mono">
                <span className="text-xs text-primary font-semibold">POST</span>
                <code className="text-xs flex-1 truncate text-foreground">{webhookUrl}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyText(webhookUrl, "URL")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-medium text-foreground">Headers obrigatórios:</p>
                <div className="grid gap-1.5 pl-3">
                  <p><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">X-API-Key: sua_chave</code></p>
                  <p><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">Content-Type: application/json</code></p>
                </div>
              </div>

              {/* Events table */}
              <div>
                <p className="text-xs font-medium mb-2 text-foreground">Eventos suportados:</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-semibold">Evento</TableHead>
                        <TableHead className="text-xs font-semibold">Descrição</TableHead>
                        <TableHead className="text-xs font-semibold">Campos (data)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {EVENTS_DOC.map((e) => (
                        <TableRow key={e.event}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">{e.event}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{e.desc}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{e.fields}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Example payload */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs font-medium mb-2">Exemplo de payload:</p>
                <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">{JSON.stringify({
                  event: "send_email",
                  data: {
                    to: "cliente@exemplo.com",
                    subject: "Confirmação de pedido",
                    html: "<h1>Pedido confirmado!</h1>",
                    recipientName: "João",
                  },
                }, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>

          {/* Webhook logs */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Eventos Recebidos</CardTitle>
              <CardDescription>Últimos 20 eventos (atualiza a cada 30s)</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8">
                  <Webhook className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum evento recebido ainda.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-semibold">Data</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold">IP</TableHead>
                        <TableHead className="text-xs font-semibold">Resposta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{format(new Date(l.created_at), "dd/MM HH:mm:ss")}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={l.status_code === 200 ? "bg-green-500/20 text-green-700" : "bg-destructive/20 text-destructive"}>
                              {l.status_code}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.ip_address || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.response_summary || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apikey" className="mt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Chave de Autenticação
              </CardTitle>
              <CardDescription>
                Esta chave é usada no header <code className="text-xs px-1 py-0.5 rounded bg-muted">X-API-Key</code> para autenticar requisições de webhook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKey ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <code className="text-xs flex-1 font-mono truncate text-foreground">{apiKey}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyText(apiKey, "API Key")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Key className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma chave gerada. Vá em <strong>Configurações → API</strong> para gerar sua chave.
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs space-y-1.5">
                <p className="font-medium text-foreground">Como usar:</p>
                <p className="text-muted-foreground">Inclua o header em todas as requisições para o webhook:</p>
                <code className="block p-2 rounded bg-muted text-foreground">X-API-Key: {apiKey || "sua_chave_aqui"}</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
