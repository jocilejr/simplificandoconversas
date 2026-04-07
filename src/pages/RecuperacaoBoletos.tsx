import { useState, useEffect } from "react";
import { MessageSquare, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

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

const RecuperacaoBoletos = () => {
  const { profile, isLoading, updateProfile } = useProfile();
  const [boletoMsg, setBoletoMsg] = useState("");
  const [pixMsg, setPixMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setBoletoMsg((profile as any).recovery_message_boleto || DEFAULT_BOLETO_MSG);
      setPixMsg((profile as any).recovery_message_pix || DEFAULT_PIX_MSG);
    }
  }, [profile]);

  const handleSave = async () => {
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

  if (isLoading) {
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
              Configure as mensagens de recuperação para transações pendentes
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

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
    </div>
  );
};

export default RecuperacaoBoletos;
