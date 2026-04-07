import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, User, Phone, Mail, FileText, Calendar, CreditCard, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Transaction } from "@/hooks/useTransactions";

const statusColors: Record<string, string> = {
  aprovado: "bg-green-500/10 text-green-600 border-green-500/30",
  pendente: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  rejeitado: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelado: "bg-red-500/10 text-red-600 border-red-500/30",
  processando: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  reembolsado: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  estornado: "bg-purple-500/10 text-purple-600 border-purple-500/30",
};

const typeLabels: Record<string, string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
  card: "Cartão",
};

interface TransactionDetailDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
}

export function TransactionDetailDialog({ transaction, open, onClose }: TransactionDetailDialogProps) {
  if (!transaction) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{value || "Não informado"}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da Transação
          </DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{typeLabels[transaction.type] || transaction.type}</Badge>
              <Badge className={statusColors[transaction.status] || ""} variant="outline">
                {transaction.status}
              </Badge>
              <span className="ml-auto font-mono text-base font-semibold text-foreground">
                {formatCurrency(transaction.amount)}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y">
          <InfoRow icon={User} label="Nome completo" value={transaction.customer_name} />
          <InfoRow icon={FileText} label="CPF / Documento" value={transaction.customer_document} />
          <InfoRow icon={Phone} label="Telefone" value={transaction.customer_phone?.replace(/\D/g, "") || null} />
          <InfoRow icon={Mail} label="Email" value={transaction.customer_email?.toLowerCase() === "businessvivaorigem@gmail.com" ? null : transaction.customer_email} />
          <InfoRow
            icon={Calendar}
            label="Data de criação"
            value={format(new Date(transaction.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          />
          {transaction.description && (
            <InfoRow icon={CreditCard} label="Descrição" value={transaction.description} />
          )}
          {(transaction.metadata as any)?.error_reason && (
            <InfoRow icon={AlertTriangle} label="Motivo do erro" value={(transaction.metadata as any).error_reason} />
          )}
        </div>

        {transaction.payment_url && (
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" asChild>
              <a href={transaction.payment_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(transaction.payment_url!);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
