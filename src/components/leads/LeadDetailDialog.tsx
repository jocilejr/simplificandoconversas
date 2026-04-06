import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, User, Phone, Mail, FileText, Tag, Bell, MessageSquare, CreditCard, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Lead } from "@/hooks/useLeads";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

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

  const paidTxs = lead.transactions.filter((t) => t.status === "aprovado");
  const unpaidTxs = lead.transactions.filter((t) => t.status !== "aprovado");

  const { data: reminders = [] } = useQuery({
    queryKey: ["lead-reminders", lead.remote_jid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("remote_jid", lead.remote_jid)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["lead-messages", lead.remote_jid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("content, direction, created_at, message_type")
        .eq("remote_jid", lead.remote_jid)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {lead.contact_name || "Lead sem nome"}
          </DialogTitle>
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
          {/* Section 1: Personal Data */}
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

          {/* Section 2: Financial Summary */}
          <Separator className="my-3" />
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Pago</p>
              <p className="text-lg font-bold font-mono text-green-600">{formatCurrency(lead.totalPaid)}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Pedidos Pagos</p>
              <p className="text-lg font-bold text-green-600">{paidTxs.length}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Não Pagos</p>
              <p className="text-lg font-bold text-yellow-600">{unpaidTxs.length}</p>
            </div>
          </div>

          {/* Section 3: Paid Transactions */}
          {paidTxs.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm font-semibold">Transações Pagas ({paidTxs.length})</p>
              </div>
              <div className="space-y-2">
                {paidTxs.map((tx) => (
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
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Section 4: Unpaid Transactions */}
          {unpaidTxs.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-yellow-500" />
                <p className="text-sm font-semibold">Transações Pendentes/Rejeitadas ({unpaidTxs.length})</p>
              </div>
              <div className="space-y-2">
                {unpaidTxs.map((tx) => (
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

          {/* Section 5: Reminders */}
          {reminders.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-semibold">Agendamentos ({reminders.length})</p>
              </div>
              <div className="space-y-2">
                {reminders.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                    </div>
                    <Badge variant={r.completed ? "secondary" : "outline"} className="text-xs shrink-0">
                      {r.completed ? "Concluído" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Section 6: Message History */}
          {messages.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Últimas Mensagens</p>
              </div>
              <div className="space-y-1.5">
                {messages.map((m, i) => (
                  <div key={i} className={`text-xs p-2 rounded-md ${m.direction === "inbound" ? "bg-muted/50" : "bg-primary/5"}`}>
                    <span className="font-medium text-muted-foreground">
                      {m.direction === "inbound" ? "📩" : "📤"}{" "}
                      {format(new Date(m.created_at), "dd/MM HH:mm")}
                    </span>
                    <p className="mt-0.5 break-all">{m.content || `[${m.message_type}]`}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="h-4" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
