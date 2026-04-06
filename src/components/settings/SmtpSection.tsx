import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSmtpConfig } from "@/hooks/useSmtpConfig";
import { Loader2, Send, Eye, EyeOff, Plus, Trash2, CheckCircle, XCircle, Wifi } from "lucide-react";

interface SmtpForm {
  id?: string;
  label: string;
  host: string;
  port: string;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

const emptyForm = (): SmtpForm => ({
  label: "", host: "", port: "465", username: "", password: "", fromEmail: "", fromName: "",
});

export function SmtpSection() {
  const { configs, isLoading, saveConfig, deleteConfig, testSmtp, verifySmtp } = useSmtpConfig();
  const [forms, setForms] = useState<SmtpForm[]>([]);
  const [showPass, setShowPass] = useState<Record<number, boolean>>({});
  const [verifyStatus, setVerifyStatus] = useState<Record<number, "idle" | "ok" | "error">>({});

  useEffect(() => {
    if (configs.length > 0) {
      setForms(configs.map((c: any) => ({
        id: c.id,
        label: c.label || "Principal",
        host: c.host || "",
        port: String(c.port || 465),
        username: c.username || "",
        password: c.password || "",
        fromEmail: c.from_email || "",
        fromName: c.from_name || "",
      })));
    } else if (forms.length === 0) {
      setForms([emptyForm()]);
    }
  }, [configs]);

  const updateForm = (idx: number, field: keyof SmtpForm, value: string) => {
    const next = [...forms];
    next[idx] = { ...next[idx], [field]: value };
    setForms(next);
  };

  const handleSave = (idx: number) => {
    const f = forms[idx];
    saveConfig.mutate({
      id: f.id,
      host: f.host,
      port: parseInt(f.port) || 465,
      username: f.username,
      password: f.password,
      from_email: f.fromEmail,
      from_name: f.fromName,
      label: f.label || "Principal",
    });
  };

  const buildSmtpParams = (idx: number) => {
    const f = forms[idx];
    if (f.id) return { smtpConfigId: f.id };
    // Not saved yet — send inline credentials
    return {
      host: f.host,
      port: parseInt(f.port) || 465,
      username: f.username,
      password: f.password,
      from_email: f.fromEmail,
      from_name: f.fromName,
    };
  };

  const handleVerify = async (idx: number) => {
    setVerifyStatus({ ...verifyStatus, [idx]: "idle" });
    try {
      await verifySmtp.mutateAsync(buildSmtpParams(idx));
      setVerifyStatus({ ...verifyStatus, [idx]: "ok" });
    } catch {
      setVerifyStatus({ ...verifyStatus, [idx]: "error" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {forms.map((f, idx) => (
        <Card key={idx} className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">
                  {f.id ? f.label || "Servidor SMTP" : "Novo Servidor SMTP"}
                </CardTitle>
                {verifyStatus[idx] === "ok" && (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                )}
                {verifyStatus[idx] === "error" && (
                  <Badge variant="secondary" className="bg-destructive/20 text-destructive">
                    <XCircle className="h-3 w-3 mr-1" /> Falha
                  </Badge>
                )}
              </div>
              {forms.length > 1 && f.id && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteConfig.mutate(f.id!)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <CardDescription>Configure seu servidor SMTP para envio de e-mails.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome/Rótulo</Label>
              <Input value={f.label} onChange={(e) => updateForm(idx, "label", e.target.value)} placeholder="Ex: Marketing, Transacional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Host SMTP</Label>
                <Input value={f.host} onChange={(e) => updateForm(idx, "host", e.target.value)} placeholder="smtp.hostinger.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Porta</Label>
                <Input value={f.port} onChange={(e) => updateForm(idx, "port", e.target.value)} placeholder="465" type="number" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Usuário (e-mail)</Label>
                <Input value={f.username} onChange={(e) => updateForm(idx, "username", e.target.value)} placeholder="contato@seudominio.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <div className="flex gap-1">
                  <Input type={showPass[idx] ? "text" : "password"} value={f.password} onChange={(e) => updateForm(idx, "password", e.target.value)} className="flex-1" />
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowPass({ ...showPass, [idx]: !showPass[idx] })}>
                    {showPass[idx] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail remetente</Label>
                <Input value={f.fromEmail} onChange={(e) => updateForm(idx, "fromEmail", e.target.value)} placeholder="contato@seudominio.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Nome do remetente</Label>
                <Input value={f.fromName} onChange={(e) => updateForm(idx, "fromName", e.target.value)} placeholder="Sua Empresa" />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => handleSave(idx)} disabled={saveConfig.isPending}>
                {saveConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => handleVerify(idx)} disabled={verifySmtp.isPending}>
                {verifySmtp.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                Verificar Conexão
              </Button>
              <Button variant="outline" onClick={() => testSmtp.mutate(f.id)} disabled={testSmtp.isPending}>
                {testSmtp.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar Teste
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => setForms([...forms, emptyForm()])}>
        <Plus className="h-4 w-4 mr-2" /> Adicionar Servidor SMTP
      </Button>
    </div>
  );
}
