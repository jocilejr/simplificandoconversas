import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, User, Phone, Mail, FileText, Tag, Bell, MessageSquare, CreditCard, CheckCircle, XCircle, ChevronDown, ChevronRight, Smartphone, ShoppingBag, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Lead } from "@/hooks/useLeads";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { generatePhoneVariations } from "@/lib/phoneNormalization";

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

function InfoRow({ icon: Icon, label, value, copyable = false }: { icon: any; label: string; value: string | null | undefined; copyable?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 group">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{label}</p>
        <p className="text-sm font-medium break-all leading-snug">{value || "-"}</p>
      </div>
      {copyable && value && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado!"); }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function SectionDivider({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 pt-5 pb-2 px-1">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-sm font-semibold flex-1">{title}</h3>
      {count !== undefined && (
        <span className="text-xs font-mono text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">{count}</span>
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
      <CollapsibleTrigger className="flex items-center gap-2.5 w-full py-3 px-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold flex-1 text-left">{title}</span>
        {count !== undefined && (
          <span className="text-xs font-mono text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">{count}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 pl-2">{children}</CollapsibleContent>
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

  const { data: reminders = [], isLoading: isLoadingReminders } = useQuery({
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

  const { data: conversationMsgCounts = {}, isLoading: isLoadingMsgCounts } = useQuery({
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

  const { data: memberProducts = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["lead-member-products", lead?.remote_jid, workspaceId],
    queryFn: async () => {
      const phone = lead!.phone_number || formatPhone(lead!.remote_jid);
      const variations = generatePhoneVariations(phone);
      if (!variations.length) return [];
      const { data } = await supabase
        .from("member_products")
        .select("id, normalized_phone, is_active, product_id, delivery_products(name)")
        .eq("workspace_id", workspaceId!)
        .in("normalized_phone", variations);
      return data || [];
    },
    enabled: open && !!lead && !!workspaceId,
  });

  if (!lead) return null;

  const instances = lead.instances || [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSelectedConversationId(null); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col">
        {/* ─── Header fixo ─── */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {lead.contact_name || "Lead sem nome"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex items-center gap-2 mt-1">
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
              </div>
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ─── Corpo scrollável ─── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-1">

          {/* Dados Pessoais */}
          <SectionDivider icon={User} title="Dados Pessoais" />
          <div className="rounded-xl border divide-y overflow-hidden">
            <InfoRow icon={User} label="Nome" value={lead.contact_name} />
            <InfoRow icon={Phone} label="Telefone" value={lead.phone_number || formatPhone(lead.remote_jid)} copyable />
            <InfoRow icon={FileText} label="CPF / Documento" value={lead.customer_document} copyable />
            <InfoRow icon={Mail} label="Email" value={lead.customer_email} copyable />
            {lead.tags.length > 0 && (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Produtos Liberados */}
          <div className="pt-3">
            <CollapsibleSection icon={ShoppingBag} title="Produtos Liberados" count={isLoadingProducts ? undefined : memberProducts.length}>
              {isLoadingProducts ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <Skeleton className="h-4 w-40" />
                    </div>
                  ))}
                </div>
              ) : memberProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto liberado</p>
              ) : (
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs gap-1.5"
                    onClick={() => {
                      const phone = lead.phone_number || formatPhone(lead.remote_jid);
                      const normalized = generatePhoneVariations(phone)[0] || phone;
                      const link = `${window.location.origin}/membros/${normalized}`;
                      navigator.clipboard.writeText(link);
                      toast.success("Link de acesso copiado!");
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Copiar link de acesso
                  </Button>
                  {memberProducts.map((mp: any) => {
                    const productName = mp.delivery_products?.name || "Produto";
                    return (
                      <div key={mp.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{productName}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={mp.is_active
                            ? "bg-green-500/10 text-green-600 border-green-500/30 text-xs shrink-0"
                            : "bg-red-500/10 text-red-600 border-red-500/30 text-xs shrink-0"
                          }
                        >
                          {mp.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CollapsibleSection>
          </div>

          {/* Resumo Financeiro */}
          <SectionDivider icon={CreditCard} title="Resumo Financeiro" />
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Total Pago</p>
              <p className="text-base font-bold font-mono text-green-600 mt-0.5">{formatCurrency(lead.totalPaid)}</p>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Pedidos Pagos</p>
              <p className="text-base font-bold text-foreground mt-0.5">{paidTxs.length}</p>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Não Pagos</p>
              <p className="text-base font-bold text-yellow-600 mt-0.5">{unpaidTxs.length}</p>
            </div>
          </div>

          {/* Pagamentos */}
          {(paidTxs.length > 0 || unpaidTxs.length > 0) && (
            <div className="pt-3">
              <CollapsibleSection icon={CreditCard} title="Pagamentos" count={paidTxs.length + unpaidTxs.length}>
                {paidTxs.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      <p className="text-xs font-semibold text-green-600">Pagas ({paidTxs.length})</p>
                    </div>
                    <div className="space-y-2">
                      {paidTxs.map((tx) => (
                        <div key={tx.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{typeLabels[tx.type] || tx.type}</Badge>
                              <Badge className={statusColors[tx.status] || ""} variant="outline" >{tx.status}</Badge>
                            </div>
                            <span className="font-mono text-sm font-semibold">{formatCurrency(tx.amount)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
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
                      <p className="text-xs font-semibold text-yellow-600">Pendentes/Rejeitadas ({unpaidTxs.length})</p>
                    </div>
                    <div className="space-y-2">
                      {unpaidTxs.map((tx) => (
                        <div key={tx.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{typeLabels[tx.type] || tx.type}</Badge>
                              <Badge className={statusColors[tx.status] || ""} variant="outline">{tx.status}</Badge>
                            </div>
                            <span className="font-mono text-sm font-semibold">{formatCurrency(tx.amount)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(tx.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {tx.description && ` — ${tx.description}`}
                          </p>
                          {tx.payment_url && (
                            <div className="flex gap-2 pt-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                                <a href={tx.payment_url} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-3 w-3 mr-1" /> PDF
                                </a>
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
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

          {/* Agendamentos */}
          <div className="pt-3">
            <CollapsibleSection icon={Bell} title="Agendamentos" count={isLoadingReminders ? undefined : reminders.length}>
              {isLoadingReminders ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : reminders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum agendamento</p>
              ) : (
                <div className="space-y-2">
                  {reminders.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
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
              )}
            </CollapsibleSection>
          </div>

          {/* Histórico de Conversas */}
          <div className="pt-3">
            <CollapsibleSection icon={MessageSquare} title="Histórico de Conversas" count={isLoadingMsgCounts ? undefined : instances.filter(i => (conversationMsgCounts[i.conversation_id] ?? 0) > 0).length} defaultOpen>
              {isLoadingMsgCounts ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border p-3 flex items-center gap-3">
                      <Skeleton className="h-4 w-4 rounded shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-4 w-4 shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (() => {
                const activeInstances = instances.filter((inst) => (conversationMsgCounts[inst.conversation_id] ?? 0) > 0);
                if (activeInstances.length === 0) return <p className="text-xs text-muted-foreground text-center py-3">Nenhuma conversa encontrada</p>;
                return (
                  <div className="space-y-2">
                    {activeInstances.map((inst) => {
                      const isSelected = selectedConversationId === inst.conversation_id;
                      const msgCount = conversationMsgCounts[inst.conversation_id] ?? 0;
                      return (
                        <div key={inst.conversation_id}>
                          <button
                            className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
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
                );
              })()}
            </CollapsibleSection>
          </div>

          <div className="h-6" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
