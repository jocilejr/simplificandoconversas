import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, Copy, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Transaction } from "@/hooks/useTransactions";

interface RecoveryPopoverProps {
  transaction: Transaction;
  recoveryMessage: string;
  clickCount: number;
  onSendWhatsApp: (phone: string, text: string) => void;
  onRecoveryClick: () => void;
  isExtensionConnected: boolean;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function replaceVariables(template: string, tx: Transaction): string {
  const name = tx.customer_name || "Cliente";
  const firstName = name.split(" ")[0];
  const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(tx.amount);

  return template
    .replace(/\{saudação\}/gi, getGreeting())
    .replace(/\{nome\}/gi, name)
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{valor\}/gi, amount);
}

export function RecoveryPopover({
  transaction,
  recoveryMessage,
  clickCount,
  onSendWhatsApp,
  onRecoveryClick,
  isExtensionConnected,
}: RecoveryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const formattedMessage = useMemo(
    () => replaceVariables(recoveryMessage, transaction),
    [recoveryMessage, transaction]
  );

  const hasPhone = !!transaction.customer_phone;

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedMessage);
    setCopied(true);
    toast.success("Mensagem copiada!");
    onRecoveryClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!hasPhone) {
      toast.error("Telefone não disponível");
      return;
    }
    onSendWhatsApp(transaction.customer_phone!, formattedMessage);
    onRecoveryClick();
    setOpen(false);
    toast.success("Mensagem enviada via extensão!");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative text-green-600 hover:text-green-700 hover:bg-green-500/10"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageSquare className="h-4 w-4" />
                {clickCount > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[9px] bg-orange-500 text-white border-0 flex items-center justify-center"
                  >
                    {clickCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Recuperar via WhatsApp</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        className="w-80 p-0"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border/30 bg-secondary/20">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Recuperação</h4>
            {clickCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {clickCount} tentativa{clickCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {transaction.customer_name || "Cliente"} • {transaction.customer_phone || "Sem telefone"}
          </p>
        </div>

        <div className="p-3">
          <div className="bg-secondary/30 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto border border-border/20">
            {formattedMessage}
          </div>
        </div>

        <div className="p-3 pt-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleCopy}
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleSendWhatsApp}
            disabled={!hasPhone || !isExtensionConnected}
          >
            <Send className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
        </div>

        {!isExtensionConnected && (
          <div className="px-3 pb-3">
            <p className="text-[10px] text-muted-foreground text-center">
              Extensão não conectada. Use "Copiar" e envie manualmente.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
