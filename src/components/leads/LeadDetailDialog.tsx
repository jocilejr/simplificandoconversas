import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, User, Phone, Mail, FileText, Tag, Bell, MessageSquare, CreditCard, CheckCircle, XCircle, ChevronDown, ChevronRight, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Lead } from "@/hooks/useLeads";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  <div className="flex items-start gap-3 py-2.5 px-1">
    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium break-all">{value || "Não informado"}</p>
    </div>
  </div>
);

function SectionHeader({ icon: Icon, title, count, sticky = false }: {
  icon: any; title: string; count?: number; sticky?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 py-2.5 px-1 ${sticky ? "sticky top-0 z-10 bg-background/95 backdrop-blur-sm" : ""}`}>
      <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <span className="text-sm font-semibold flex-1">{title}</span>
      {count !== undefined && (
        <Badge variant="secondary" className="text-xs font-mono px-2">{count}</Badge>
      )}
    </div>
  );
}

function CollapsibleSection({ icon: Icon, title, count, children, defaultOpen = false }: {
  icon: any; title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2.5 w-full py-2.5 hover:bg-muted/50 rounded-md px-1 transition-colors">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold flex-1 text-left">{title}</span>
        {count !== undefined && (
          <Badge variant="secondary" className="text-xs font-mono px-2">{count}</Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pl-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function InstanceMessageHistory({ conversationId }: { conversationId: string }) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["lead-instance-messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("content, direction, created_at, message_type")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!conversationId,
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-4 text-center">Carregando mensagens...</div>;
  if (messages.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">Nenhuma mensagem encontrada.</div>;

  return (
    <ScrollArea className="h-[400px] border rounded-lg p-3">
      <div className="space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`text-xs p-2.5 rounded-lg max-w-[85%] ${
            m.direction === "inbound"
              ? "bg-muted/60 mr-auto"
              : "bg-primary/10 ml-auto"
          }`}>
            <p className="break-all">{m.content || `[${m.message_type}]`}</p>
            <span className="text-[10px] text-muted-foreground mt-1 block">
              {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export function LeadDetailDialog({ lead, open, onClose }: Props) {
  const { workspaceId } = useWorkspace();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const formatPhone = (jid: string) => jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");

  const paidTxs = lead?.transactions.filter((t) => t.status === "aprovado") || [];
  const unpaidTxs = lead?.transactions.filter((t) => t.status !== "aprovado") || [];

  const { data: reminders = [] } = useQuery({
    queryKey: ["lead-reminders", lead?.remote_jid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("remote_jid", lead!.remote_jid)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!lead,
  });

  const { data: conversationMsgCounts = {} } = useQuery({
    queryKey: ["lead-conv-msg-counts", lead?.remote_jid, workspaceId],
    queryFn: async () => {
      const ids = lead!.instances.map((i) => i.conversation_id);
      const counts: Record<string, number> = {};
      for (const id of ids) {
        const { count, error } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", id);
        if (!error && count !== null) counts[id] = count;
      }
      return counts;
    },
    enabled: open && !!lead && (lead?.instances?.length ?? 0) > 0,
  });

  if (!lead) return null;

  const instances = lead.instances || [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSelectedConversationId(null); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-4 border-b bg-background">
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
        </div>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-1">

            {/* ── Seção: Dados Pessoais ── */}
            <SectionHeader icon={User} title="Dados Pessoais" />
            <div className="rounded-lg border bg-card divide-y">
              <InfoRow icon={User} label="Nome" value={lead.contact_name} />
              <InfoRow icon={Phone} label="Telefone" value={lead.phone_number || formatPhone(lead.remote_jid)} />
              <InfoRow icon={FileText} label="CPF / Documento" value={lead.customer_document} />
              <InfoRow icon={Mail} label="Email" value={lead.customer_email} />
              {lead.tags.length > 0 && (
                <div className="flex items-start gap-3 py-2.5 px-1">
                  <Tag className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tags</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lead.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Seção: Resumo Financeiro ── */}
            <div className="pt-3">
              <SectionHeader icon={CreditCard} title="Resumo Financeiro" />
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Pago</p>
                  <p className="text-lg font-bold font-mono text-green-600">{formatCurrency(lead.totalPaid)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Pedidos Pagos</p>
                  <p className="text-lg font-bold text-green-600">{paidTxs.length}</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Não Pagos</p>
                  <p className="text-lg font-bold text-yellow-600">{unpaidTxs.length}</p>
                </div>
              </div>
            </div>

            {/* ── Seção: Pagamentos ── */}
            {(paidTxs.length > 0 || unpaidTxs.length > 0) && (
              <div className="pt-3">
                <CollapsibleSection icon={CreditCard} title="Pagamentos" count={paidTxs.length + unpaidTxs.length}>
                  {paidTxs.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        <p className="text-xs font-medium text-green-600">Pagas ({paidTxs.length})</p>
                      </div>
                      <div className="space-y-2">
                        {paidTxs.map((tx) => (
                          <div key={tx.id} className="rounded-lg border bg-card p-3 space-y-1">
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
                    </div>
                  )}
                  {unpaidTxs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-3.5 w-3.5 text-yellow-500" />
                        <p className="text-xs font-medium text-yellow-600">Pendentes/Rejeitadas ({unpaidTxs.length})</p>
                      </div>
                      <div className="space-y-2">
                        {unpaidTxs.map((tx) => (
                          <div key={tx.id} className="rounded-lg border bg-card p-3 space-y-1">
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
                    </div>
                  )}
                </CollapsibleSection>
              </div>
            )}

            {/* ── Seção: Agendamentos ── */}
            {reminders.length > 0 && (
              <div className="pt-3">
                <CollapsibleSection icon={Bell} title="Agendamentos" count={reminders.length}>
                  <div className="space-y-2">
                    {reminders.map((r) => (
                      <div key={r.id} className="rounded-lg border bg-card p-3 flex items-center justify-between">
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
                </CollapsibleSection>
              </div>
            )}

            {/* ── Seção: Histórico de Conversas ── */}
            {instances.length > 0 && (
              <div className="pt-3">
                <CollapsibleSection icon={MessageSquare} title="Histórico de Conversas" count={instances.length} defaultOpen>
                  <div className="space-y-2">
                    {instances.map((inst) => {
                      const isSelected = selectedConversationId === inst.conversation_id;
                      const msgCount = conversationMsgCounts[inst.conversation_id] ?? 0;
                      return (
                        <div key={inst.conversation_id}>
                          <button
                            className={`w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50 ${
                              isSelected ? "border-primary bg-primary/5" : ""
                            }`}
                            onClick={() => setSelectedConversationId(isSelected ? null : inst.conversation_id)}
                          >
                            <div className="flex items-center gap-3">
                              <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{inst.instance_name || "Sem instância"}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {msgCount} mensagen{msgCount !== 1 ? "s" : ""}
                                  {inst.last_message_at && ` · Última: ${format(new Date(inst.last_message_at), "dd/MM HH:mm")}`}
                                </p>
                              </div>
                              {isSelected ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </button>
                          {isSelected && (
                            <div className="mt-2">
                              <InstanceMessageHistory conversationId={inst.conversation_id} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              </div>
            )}

            <div className="h-4" />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
