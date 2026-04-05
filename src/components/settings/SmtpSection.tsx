import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSmtpConfig } from "@/hooks/useSmtpConfig";
import { Loader2, Send, Eye, EyeOff } from "lucide-react";

export function SmtpSection() {
  const { config, isLoading, saveConfig, testSmtp } = useSmtpConfig();
  const [host, setHost] = useState("");
  const [port, setPort] = useState("465");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (config) {
      setHost(config.host || "");
      setPort(String(config.port || 465));
      setUsername(config.username || "");
      setPassword(config.password || "");
      setFromEmail(config.from_email || "");
      setFromName(config.from_name || "");
    }
  }, [config]);

  const handleSave = () => {
    saveConfig.mutate({
      host, port: parseInt(port) || 465, username, password, from_email: fromEmail, from_name: fromName,
    });
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Configuração SMTP (E-mail)</CardTitle>
        <CardDescription>
          Configure seu servidor SMTP para envio de e-mails. Use as credenciais da Hostinger ou outro provedor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Host SMTP</Label>
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.hostinger.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Porta</Label>
            <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="465" type="number" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Usuário (e-mail)</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="contato@seudominio.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <div className="flex gap-1">
              <Input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1" />
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>E-mail remetente</Label>
            <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="contato@seudominio.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome do remetente</Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Origem Viva" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveConfig.isPending}>
            {saveConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
          <Button variant="outline" onClick={() => testSmtp.mutate()} disabled={testSmtp.isPending}>
            {testSmtp.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar Teste
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
