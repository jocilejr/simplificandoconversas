import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, User, Phone, Mail, FileText, Calendar, CreditCard, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Lead } from "@/hooks/useLeads";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const statusColors: Record<string, string> = {
  aprovado: "bg-green-500/10 text-green-600 border-green-500/30",
  pendente: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  rejeitado: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelado: "bg-red-500/10 text-red-600 border-red-500/30",
};

const typeLabels: Record<string, string> = {
  boleto: "Boleto", pix: "PIX", cartao: "Cartão", card: "Cartão",
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
  <div className="flex items-start gap-3 py-2">
    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-all">{value || "Não informado"}</p>
    </div>
  </div>
);

export function LeadDetailDialog({ lead, open, onClose }: Props) {
  if (!lead) return null;

  const formatPhone = (jid: string) => {
    const num = jid.replace("@s.whatsapp.net", "");
    if (num.length >= 12) return `+${num.slice(0, 2)} (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
    return num;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes do Lead</DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-2 mt-1">
              {lead.hasPaid ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/30" variant="outline">✅ Pagou</Badge>
              ) : (
                <Badge variant="outline">❌ Não pagou</Badge>
              )}
              {lead.hasPaid && (
                <span className="ml-auto font-mono text-base font-semibold text-foreground">
                  {formatCurrency(lead.totalPaid)}
                </span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="divide-y">
            <InfoRow icon={User} label="Nome" value={lead.contact_name} />
            <InfoRow icon={Phone} label="Telefone" value={lead.phone_number || formatPhone(lead.remote_jid)} />
            <InfoRow icon={FileText} label="CPF / Documento" value={lead.customer_document} />
            <InfoRow icon={Mail} label="Email" value={lead.customer_email} />
            {lead.tags.length > 0 && (
              <div className="flex items-start gap-3 py-2">
                <Tag className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lead.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {lead.transactions.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-sm font-semibold mb-2">Transações ({lead.transactions.length})</p>
              <div className="space-y-2">
                {lead.transactions.map((tx) => (
                  <div key={tx.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{typeLabels[tx.type] || tx.type}</Badge>
                        <Badge className={statusColors[tx.status] || ""} variant="outline">{tx.status}</Badge>
                      </div>
                      <span className="font-mono text-sm font-semibold">{formatCurrency(tx.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {tx.description && ` — ${tx.description}`}
                    </p>
                    {tx.payment_url && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" asChild>
                          <a href={tx.payment_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3 mr-1" /> PDF
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          navigator.clipboard.writeText(tx.payment_url!);
                          toast.success("Link copiado!");
                        }}>
                          <Copy className="h-3 w-3 mr-1" /> Link
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
