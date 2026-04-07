import { useState, useEffect } from "react";
import { MessageSquare, Save, Info, Settings2, Clock, Zap, X, RefreshCw, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useRecoverySettings, useRecoveryQueue } from "@/hooks/useRecoverySettings";
import { toast } from "sonner";
import { format } from "date-fns";

const DEFAULT_BOLETO_MSG = `{saudação}, {primeiro_nome}! 😊

Vi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?

Caso já tenha pago, pode desconsiderar essa mensagem! 🙏`;

const DEFAULT_PIX_MSG = `{saudação}, {primeiro_nome}! 😊

Notei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?

Se já realizou o pagamento, por favor desconsidere! 🙏`;

const VARIABLES = [
  { key: "{saudação}", desc: "Bom dia / Boa tarde / Boa noite" },
  { key: "{nome}", desc: "Nome completo do cliente" },
  { key: "{primeiro_nome}", desc: "Primeiro nome do cliente" },
  { key: "{valor}", desc: "Valor da transação (R$)" },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600",
  sent: "bg-green-500/10 text-green-600",
  failed: "bg-red-500/10 text-red-600",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

const RecuperacaoBoletos = () => {
  const { profile, isLoading: profileLoading, updateProfile } = useProfile();
  const { instances } = useWhatsAppInstances();
  const { settings, isLoading: settingsLoading, upsert } = useRecoverySettings();
  const { queue, isLoading: queueLoading, cancelItem, refetch: refetchQueue } = useRecoveryQueue();

  const [boletoMsg, setBoletoMsg] = useState("");
  const [pixMsg, setPixMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Auto-recovery settings local state
  const [enabled, setEnabled] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(20);
  const [sendAfterMinutes, setSendAfterMinutes] = useState(5);

  useEffect(() => {
    if (profile) {
      setBoletoMsg((profile as any).recovery_message_boleto || DEFAULT_BOLETO_MSG);
      setPixMsg((profile as any).recovery_message_pix || DEFAULT_PIX_MSG);
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled ?? false);
      setInstanceName(settings.instance_name || "");
      setDelaySeconds(settings.delay_seconds ?? 20);
      setSendAfterMinutes(settings.send_after_minutes ?? 5);
    }
  }, [settings]);

  const handleSaveMessages = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        recovery_message_boleto: boletoMsg,
        recovery_message_pix: pixMsg,
      } as any);
      toast.success("Mensagens salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar mensagens");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await upsert.mutateAsync({
        enabled,
        delay_seconds: Math.max(delaySeconds, 20),
        send_after_minutes: Math.max(sendAfterMinutes, 1),
      });
      toast.success("Configurações de envio automático salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
  };

  const pendingCount = queue.filter((q: any) => q.status === "pending").length;

  if (profileLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-500/10">
            <MessageSquare className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Recuperação</h1>
            <p className="text-sm text-muted-foreground">
              Configure as mensagens e o envio automático de recuperação
            </p>
          </div>
        </div>
      </div>

      {/* Auto Recovery Settings */}
      <div className="bg-card border border-border/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Envio Automático</h3>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingCount} na fila
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {enabled ? "Ativado" : "Desativado"}
            </span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        {enabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Instância WhatsApp</label>
              <Select value={instanceName} onValueChange={setInstanceName}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(instances || []).map((inst: any) => (
                    <SelectItem key={inst.instance_name} value={inst.instance_name}>
                      {inst.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Delay entre mensagens (seg)</label>
              <Input
                type="number"
                min={20}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Math.max(20, parseInt(e.target.value) || 20))}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Mínimo 20 segundos</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Aguardar antes de enviar (min)</label>
              <Input
                type="number"
                min={1}
                value={sendAfterMinutes}
                onChange={(e) => setSendAfterMinutes(Math.max(1, parseInt(e.target.value) || 5))}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Tempo após criação da transação</p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSaveSettings} disabled={upsert.isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {upsert.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {/* Queue Visualization */}
      {enabled && (
        <div className="bg-card border border-border/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Fila de Recuperação</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchQueue()} className="gap-1.5 h-7">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>

          {queueLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : queue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum item na fila
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-2">Cliente</th>
                    <th className="text-left py-2 pr-2">Valor</th>
                    <th className="text-left py-2 pr-2">Tipo</th>
                    <th className="text-left py-2 pr-2">Status</th>
                    <th className="text-left py-2 pr-2">Agendado</th>
                    <th className="text-left py-2 pr-2">Enviado</th>
                    <th className="text-right py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item: any) => (
                    <tr key={item.id} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-2">
                        <div>
                          <p className="font-medium text-xs">{item.customer_name || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{item.customer_phone}</p>
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        R$ {Number(item.amount).toFixed(2).replace(".", ",")}
                      </td>
                      <td className="py-2 pr-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.transaction_type}
                        </Badge>
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[item.status] || ""}`}>
                          {statusLabels[item.status] || item.status}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-[10px] text-muted-foreground">
                        {item.scheduled_at ? format(new Date(item.scheduled_at), "dd/MM HH:mm") : "—"}
                      </td>
                      <td className="py-2 pr-2 text-[10px] text-muted-foreground">
                        {item.sent_at ? format(new Date(item.sent_at), "dd/MM HH:mm") : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {item.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => cancelItem.mutate(item.id)}
                            title="Cancelar"
                          >
                            <Ban className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Variables Reference */}
      <div className="bg-card border border-border/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Variáveis disponíveis</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((v) => (
            <div key={v.key} className="flex items-center gap-1.5">
              <Badge variant="secondary" className="font-mono text-xs">
                {v.key}
              </Badge>
              <span className="text-xs text-muted-foreground">{v.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Boleto Message */}
      <div className="bg-card border border-border/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <h3 className="text-sm font-semibold">Mensagem para Boletos</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Enviada ao recuperar transações de boletos não pagos
        </p>
        <Textarea
          value={boletoMsg}
          onChange={(e) => setBoletoMsg(e.target.value)}
          rows={6}
          className="font-mono text-sm"
          placeholder="Digite a mensagem de recuperação para boletos..."
        />
      </div>

      {/* PIX/Card Message */}
      <div className="bg-card border border-border/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <h3 className="text-sm font-semibold">Mensagem para PIX / Cartão</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Enviada ao recuperar transações pendentes de PIX ou Cartão
        </p>
        <Textarea
          value={pixMsg}
          onChange={(e) => setPixMsg(e.target.value)}
          rows={6}
          className="font-mono text-sm"
          placeholder="Digite a mensagem de recuperação para PIX/Cartão..."
        />
      </div>

      {/* Save Messages Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveMessages} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Mensagens"}
        </Button>
      </div>
    </div>
  );
};

export default RecuperacaoBoletos;
