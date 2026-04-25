import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings2, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { useRecoverySettings } from "@/hooks/useRecoverySettings";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RecoverySettingsDialogProps {
  type: "boleto" | "pix" | "abandoned";
}

const VARIABLES = [
  { key: "{saudação}", desc: "Bom dia / Boa tarde / Boa noite" },
  { key: "{nome}", desc: "Nome completo" },
  { key: "{primeiro_nome}", desc: "Primeiro nome" },
  { key: "{valor}", desc: "Valor (R$)" },
];

const DEFAULT_BOLETO_MSG = `{saudação}, {primeiro_nome}! 😊\n\nVi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?\n\nCaso já tenha pago, pode desconsiderar essa mensagem! 🙏`;
const DEFAULT_PIX_MSG = `{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏`;
const DEFAULT_ABANDONED_MSG = `{saudação}, {primeiro_nome}! 😊\n\nVi que você teve um problema com seu pagamento de {valor}. Posso te ajudar a finalizar?\n\nSe já resolveu, pode desconsiderar! 🙏`;

export function RecoverySettingsDialog({ type }: RecoverySettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const { settings, upsert } = useRecoverySettings();

  const fieldKey = type === "boleto" ? "recovery_message_boleto" : type === "pix" ? "recovery_message_pix" : "recovery_message_abandoned";
  const defaultMsg = type === "boleto" ? DEFAULT_BOLETO_MSG : type === "pix" ? DEFAULT_PIX_MSG : DEFAULT_ABANDONED_MSG;
  const title = type === "boleto" ? "Mensagem de Recuperação - Boletos" : type === "pix" ? "Mensagem de Recuperação - PIX/Cartão" : "Mensagem de Recuperação - Rejeitados/Abandonados";

  useEffect(() => {
    if (open) {
      setMessage((settings as any)?.[fieldKey] || defaultMsg);
    }
  }, [open, settings]);

  const handleSave = async () => {
    if (!message.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }
    upsert.mutate({ [fieldKey]: message.trim() } as any, {
      onSuccess: () => {
        toast.success("Mensagem atualizada!");
        setOpen(false);
      },
      onError: () => toast.error("Erro ao atualizar"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Configurar mensagem de recuperação</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Variáveis disponíveis:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <Badge
                key={v.key}
                variant="secondary"
                className="font-mono text-[10px] cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => setMessage((prev) => prev + v.key)}
              >
                {v.key}
              </Badge>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Ex: Olá {primeiro_nome}! Seu pagamento de {valor} está pendente...`}
              className="min-h-[120px] font-mono text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
