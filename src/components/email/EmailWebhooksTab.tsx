import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Webhook, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const EVENTS_DOC = [
  {
    event: "send_email",
    desc: "Dispara envio de e-mail individual",
    fields: "to, subject, html, templateId?, recipientName?",
  },
  {
    event: "trigger_campaign",
    desc: "Inicia envio de uma campanha existente",
    fields: "campaignId",
  },
  {
    event: "add_to_campaign",
    desc: "Adiciona contato aos follow-ups de uma campanha",
    fields: "campaignId, email, name?",
  },
];

export function EmailWebhooksTab() {
  const { toast } = useToast();

  const { data: logs = [], isLoading } = useQuery({
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

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "URL copiada!" });
  };

  return (
    <div className="space-y-4">
      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhook de E-mail
          </CardTitle>
          <CardDescription>
            Receba eventos externos para disparar e-mails automaticamente. Use a URL abaixo como endpoint no seu sistema externo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
            <code className="text-xs flex-1 truncate">POST {webhookUrl}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyUrl}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Header obrigatório: <code className="text-foreground">X-API-Key: sua_chave</code></p>
            <p>• Content-Type: <code className="text-foreground">application/json</code></p>
            <p>• Body: <code className="text-foreground">{`{ "event": "...", "data": { ... } }`}</code></p>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Evento</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Campos (data)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EVENTS_DOC.map((e) => (
                  <TableRow key={e.event}>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{e.event}</Badge></TableCell>
                    <TableCell className="text-xs">{e.desc}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{e.fields}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-3 rounded-md bg-muted/30 border">
            <p className="text-xs font-medium mb-2">Exemplo de payload:</p>
            <pre className="text-xs text-muted-foreground overflow-x-auto">{JSON.stringify({
              event: "send_email",
              data: {
                to: "cliente@exemplo.com",
                subject: "Confirmação de pedido",
                html: "<h1>Pedido confirmado!</h1><p>Obrigado pela compra.</p>",
                recipientName: "João",
              },
            }, null, 2)}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Webhook events log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos Recebidos</CardTitle>
          <CardDescription>Últimos 20 eventos de webhook recebidos (atualiza a cada 30s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento recebido ainda.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">IP</TableHead>
                    <TableHead className="text-xs">Resposta</TableHead>
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
    </div>
  );
}
