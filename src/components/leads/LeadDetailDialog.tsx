import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Copy, Download, User, Phone, Mail, FileText, Tag, Bell,
  MessageSquare, CreditCard, CheckCircle, XCircle, ChevronDown,
  ChevronRight, Smartphone, ShoppingBag, ExternalLink, Pencil,
  Save, X, Plus, DollarSign, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Lead } from "@/hooks/useLeads";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { generatePhoneVariations, findExistingMemberPhone } from "@/lib/phoneNormalization";
import { normalizePhone } from "@/lib/normalizePhone";
import { Label } from "@/components/ui/label";

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

/* ─── Sub-components ─── */

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold font-mono ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function TxCard({ tx }: { tx: any }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabels[tx.type] || tx.type}</Badge>
          <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[tx.status] || ""}`} variant="outline">{tx.status}</Badge>
        </div>
        <span className="font-mono text-sm font-semibold">{formatCurrency(tx.amount)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        {format(new Date(tx.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        {tx.description && <span className="truncate">— {tx.description}</span>}
      </div>
      {tx.payment_url && (
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" asChild>
            <a href={tx.payment_url} target="_blank" rel="noopener noreferrer">
              <Download className="h-3 w-3 mr-1" /> PDF
            </a>
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => {
            navigator.clipboard.writeText(tx.payment_url!);
            toast.success("Link copiado!");
          }}>
            <Copy className="h-3 w-3 mr-1" /> Link
          </Button>
        </div>
      )}
    </div>
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
    <ScrollArea className="h-[350px] border rounded-lg p-3">
      <div className="space-y-1.5">
        {messages.map((m, i) => (
          <div key={i} className={`text-xs p-2 rounded-lg max-w-[80%] ${
            m.direction === "inbound"
              ? "bg-muted/60 mr-auto"
              : "bg-primary/10 ml-auto"
          }`}>
            <p className="break-all leading-relaxed">{m.content || `[${m.message_type}]`}</p>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {format(new Date(m.created_at), "dd/MM HH:mm")}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/* ─── Main Dialog ─── */

export function LeadDetailDialog({ lead, open, onClose }: Props) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", document: "" });
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  // Manual payment state
  const [paymentForm, setPaymentForm] = useState({ amount: "", description: "", type: "pix", status: "aprovado" });
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const formatPhone = (jid: string) => jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");

  const startEditing = () => {
    if (!lead) return;
    setEditForm({
      name: lead.contact_name || "",
      phone: lead.phone_number || formatPhone(lead.remote_jid),
      email: lead.customer_email || "",
      document: lead.customer_document || "",
    });
    setEditing(true);
  };

  const cancelEditing = () => { setEditing(false); setNewTag(""); };

  const saveEdits = async () => {
    if (!lead || !workspaceId) return;
    setSaving(true);
    try {
      const convIds = lead.instances.map((i) => i.conversation_id);
      if (convIds.length > 0) {
        const { error } = await supabase
          .from("conversations")
          .update({
            contact_name: editForm.name || null,
            phone_number: editForm.phone || null,
            email: editForm.email || null,
            document: editForm.document || null,
          } as any)
          .in("id", convIds);
        if (error) throw error;
      }
      if (editForm.document !== (lead.customer_document || "")) {
        const txIds = lead.transactions.map((t) => t.id);
        if (txIds.length > 0) {
          await supabase.from("transactions" as any).update({ customer_document: editForm.document || null } as any).in("id", txIds);
        }
      }
      if (editForm.email !== (lead.customer_email || "")) {
        const txIds = lead.transactions.map((t) => t.id);
        if (txIds.length > 0) {
          await supabase.from("transactions" as any).update({ customer_email: editForm.email || null } as any).in("id", txIds);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["leads-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["leads-transactions"] });
      toast.success("Dados atualizados!");
      setEditing(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const addTag = async () => {
    if (!lead || !workspaceId || !newTag.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("contact_tags").insert({
      remote_jid: lead.remote_jid, tag_name: newTag.trim(), user_id: user.id, workspace_id: workspaceId,
    });
    if (error) { toast.error("Erro ao adicionar tag"); return; }
    queryClient.invalidateQueries({ queryKey: ["leads-tags"] });
    toast.success("Tag adicionada!");
    setNewTag("");
  };

  const removeTag = async (tagName: string) => {
    if (!lead || !workspaceId) return;
    const { error } = await supabase.from("contact_tags").delete()
      .eq("remote_jid", lead.remote_jid).eq("tag_name", tagName).eq("workspace_id", workspaceId);
    if (error) { toast.error("Erro ao remover tag"); return; }
    queryClient.invalidateQueries({ queryKey: ["leads-tags"] });
    toast.success("Tag removida!");
  };

  // Manual payment mutation
  const addPayment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !workspaceId || !lead) throw new Error("Dados insuficientes");
      const amount = parseFloat(paymentForm.amount.replace(",", "."));
      if (isNaN(amount) || amount <= 0) throw new Error("Valor inválido");
      const phone = lead.phone_number || formatPhone(lead.remote_jid);
      const { error } = await supabase.from("transactions" as any).insert({
        user_id: user.id,
        workspace_id: workspaceId,
        amount,
        type: paymentForm.type,
        status: paymentForm.status,
        description: paymentForm.description || "Pagamento manual",
        customer_name: lead.contact_name || null,
        customer_phone: phone,
        normalized_phone: phone.replace(/\D/g, ""),
        customer_email: lead.customer_email || null,
        customer_document: lead.customer_document || null,
        source: "manual",
        webhook_source: "manual",
        paid_at: paymentForm.status === "aprovado" ? new Date().toISOString() : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Pagamento adicionado!");
      setPaymentForm({ amount: "", description: "", type: "pix", status: "aprovado" });
      setShowPaymentForm(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: deliverySettings } = useQuery({
    queryKey: ["delivery-settings", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("delivery_settings").select("custom_domain").eq("workspace_id", workspaceId!).maybeSingle();
      return data;
    },
  });

  const paidTxs = lead?.transactions.filter((t) => t.status === "aprovado") || [];
  const unpaidTxs = lead?.transactions.filter((t) => t.status !== "aprovado") || [];

  const { data: reminders = [], isLoading: isLoadingReminders } = useQuery({
    queryKey: ["lead-reminders", lead?.remote_jid],
    queryFn: async () => {
      const { data, error } = await supabase.from("reminders").select("*").eq("remote_jid", lead!.remote_jid).order("due_date", { ascending: false });
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
        const { count, error } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", id);
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
      const { apiUrl, safeJsonResponse } = await import("@/lib/api");
      const res = await fetch(apiUrl(`platform/member-products?phones=${variations.join(",")}&workspace_id=${workspaceId}`));
      const data = await safeJsonResponse(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao buscar produtos");
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !!lead && !!workspaceId,
  });

  if (!lead) return null;

  const instances = lead.instances || [];
  const activeInstances = instances.filter((inst) => (conversationMsgCounts[inst.conversation_id] ?? 0) > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSelectedConversationId(null); cancelEditing(); setShowPaymentForm(false); } }}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col [&>button]:hidden">

        {/* ─── Header ─── */}
        <div className="shrink-0 px-6 pt-6 pb-5 bg-card">
          <DialogHeader className="space-y-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold truncate">{lead.contact_name || "Lead sem nome"}</DialogTitle>
                  <DialogDescription className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-xs">{lead.phone_number || formatPhone(lead.remote_jid)}</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => {
                      navigator.clipboard.writeText(lead.phone_number || formatPhone(lead.remote_jid));
                      toast.success("Copiado!");
                    }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lead.hasPaid ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/30" variant="outline">Pagou</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Sem pagamento</Badge>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2.5 mt-5">
            <StatCard label="Total Pago" value={formatCurrency(lead.totalPaid)} color="text-green-600" />
            <StatCard label="Pedidos" value={String(paidTxs.length)} />
            <StatCard label="Pendentes" value={String(unpaidTxs.length)} color="text-yellow-600" />
          </div>
        </div>

        {/* ─── Tabbed Content ─── */}
        <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-6">
            <TabsList className="h-10 w-full bg-transparent p-0 gap-0 justify-start border-b rounded-none">
              {[
                { value: "info", label: "Dados" },
                { value: "financial", label: "Financeiro" },
                { value: "products", label: "Produtos" },
                { value: "history", label: "Conversas" },
                { value: "reminders", label: "Agendamentos" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-xs font-medium h-10 -mb-px"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">

            {/* ─── TAB: Dados ─── */}
            <TabsContent value="info" className="px-6 py-5 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Informações Pessoais</h3>
                {!editing ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={startEditing}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEditing} disabled={saving}>
                      <X className="h-3 w-3" />
                    </Button>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={saveEdits} disabled={saving}>
                      <Save className="h-3 w-3" /> {saving ? "..." : "Salvar"}
                    </Button>
                  </div>
                )}
              </div>

              {editing ? (
                <div className="grid gap-3">
                  {[
                    { icon: User, label: "Nome", key: "name" as const, placeholder: "Nome do lead" },
                    { icon: Phone, label: "Telefone", key: "phone" as const, placeholder: "5511999999999", mono: true },
                    { icon: FileText, label: "CPF / Documento", key: "document" as const, placeholder: "000.000.000-00", mono: true },
                    { icon: Mail, label: "Email", key: "email" as const, placeholder: "email@exemplo.com" },
                  ].map(({ icon: Icon, label, key, placeholder, mono }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Icon className="h-3 w-3" /> {label}
                      </Label>
                      <Input
                        className={`h-8 text-sm ${mono ? "font-mono" : ""}`}
                        value={editForm[key]}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-0.5">
                  {[
                    { icon: User, label: "Nome", value: lead.contact_name },
                    { icon: Phone, label: "Telefone", value: lead.phone_number || formatPhone(lead.remote_jid), copy: true, mono: true },
                    { icon: FileText, label: "CPF", value: lead.customer_document, copy: true, mono: true },
                    { icon: Mail, label: "Email", value: lead.customer_email, copy: true },
                  ].map(({ icon: Icon, label, value, copy, mono }) => (
                    <div key={label} className="flex items-center gap-3 py-2 group rounded-md hover:bg-muted/50 px-2 -mx-2 transition-colors">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className={`text-sm ${mono ? "font-mono" : ""} ${value ? "" : "text-muted-foreground italic"}`}>
                          {value || "Não informado"}
                        </p>
                      </div>
                      {copy && value && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado!"); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => removeTag(t)}>
                      {t} <X className="h-2.5 w-2.5" />
                    </Badge>
                  ))}
                  {lead.tags.length === 0 && <span className="text-xs text-muted-foreground italic">Nenhuma tag</span>}
                </div>
                <div className="flex gap-1.5">
                  <Input className="h-7 text-xs flex-1" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nova tag..."
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={addTag} disabled={!newTag.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ─── TAB: Financeiro ─── */}
            <TabsContent value="financial" className="px-6 py-5 space-y-4 mt-0">
              {/* Add payment button */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pagamentos</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowPaymentForm(!showPaymentForm)}>
                  <DollarSign className="h-3 w-3" /> {showPaymentForm ? "Cancelar" : "Inserir Pagamento"}
                </Button>
              </div>

              {/* Manual payment form */}
              {showPaymentForm && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Valor (R$) *</Label>
                      <Input
                        className="h-8 text-sm font-mono"
                        placeholder="0,00"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={paymentForm.type} onValueChange={(v) => setPaymentForm({ ...paymentForm, type: v })}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="cartao">Cartão</SelectItem>
                          <SelectItem value="boleto">Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Descrição</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Descrição do pagamento"
                        value={paymentForm.description}
                        onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={paymentForm.status} onValueChange={(v) => setPaymentForm({ ...paymentForm, status: v })}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="pendente">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button size="sm" className="w-full h-8 text-xs" onClick={() => addPayment.mutate()} disabled={addPayment.isPending || !paymentForm.amount}>
                    {addPayment.isPending ? "Salvando..." : "Confirmar Pagamento"}
                  </Button>
                </div>
              )}

              {/* Paid transactions */}
              {paidTxs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    <p className="text-xs font-semibold text-green-600">Aprovados ({paidTxs.length})</p>
                  </div>
                  <div className="space-y-1.5">
                    {paidTxs.map((tx) => <TxCard key={tx.id} tx={tx} />)}
                  </div>
                </div>
              )}

              {/* Unpaid transactions */}
              {unpaidTxs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-yellow-500" />
                    <p className="text-xs font-semibold text-yellow-600">Pendentes / Rejeitados ({unpaidTxs.length})</p>
                  </div>
                  <div className="space-y-1.5">
                    {unpaidTxs.map((tx) => <TxCard key={tx.id} tx={tx} />)}
                  </div>
                </div>
              )}

              {paidTxs.length === 0 && unpaidTxs.length === 0 && !showPaymentForm && (
                <div className="text-center py-8 space-y-2">
                  <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground">Nenhum pagamento registrado</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowPaymentForm(true)}>
                    <Plus className="h-3 w-3" /> Inserir primeiro pagamento
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ─── TAB: Produtos ─── */}
            <TabsContent value="products" className="px-6 py-5 space-y-3 mt-0">
              {isLoadingProducts ? (
                <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
              ) : memberProducts.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground">Nenhum produto liberado</p>
                </div>
              ) : (
                <>
                  <Button
                    size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5"
                    onClick={() => {
                      const phoneRaw = lead.phone_number || formatPhone(lead.remote_jid);
                      const normalized = normalizePhone(phoneRaw);
                      if (normalized === "-") { toast.error("Telefone inválido"); return; }
                      if (!deliverySettings?.custom_domain) { toast.error("Configure o domínio nas configurações"); return; }
                      const existingPhone = findExistingMemberPhone(
                        (memberProducts || []).map((mp: any) => ({ phone: mp.phone || "", is_active: mp.is_active ?? true, product_id: mp.product_id || mp.delivery_products?.id || "" })),
                        phoneRaw, memberProducts?.[0]?.product_id || ""
                      );
                      const phoneForUrl = existingPhone || normalized;
                      let domain = deliverySettings.custom_domain;
                      if (!domain.startsWith("http")) domain = `https://${domain}`;
                      const link = `${domain.replace(/\/$/, "")}/${phoneForUrl}`;
                      navigator.clipboard.writeText(link);
                      toast.success("Link de acesso copiado!");
                    }}
                  >
                    <ExternalLink className="h-3 w-3" /> Copiar link de acesso
                  </Button>
                  {memberProducts.map((mp: any) => (
                    <div key={mp.id} className="rounded-lg border bg-card p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{mp.delivery_products?.name || "Produto"}</span>
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${mp.is_active ? "bg-green-500/10 text-green-600 border-green-500/30" : "bg-red-500/10 text-red-600 border-red-500/30"}`}>
                        {mp.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            {/* ─── TAB: Conversas ─── */}
            <TabsContent value="history" className="px-6 py-5 space-y-2 mt-0">
              {isLoadingMsgCounts ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
              ) : activeInstances.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground">Nenhuma conversa encontrada</p>
                </div>
              ) : (
                activeInstances.map((inst) => {
                  const isSelected = selectedConversationId === inst.conversation_id;
                  const msgCount = conversationMsgCounts[inst.conversation_id] ?? 0;
                  return (
                    <div key={inst.conversation_id} className="space-y-2">
                      <button
                        className={`w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50 ${isSelected ? "border-primary bg-primary/5" : ""}`}
                        onClick={() => setSelectedConversationId(isSelected ? null : inst.conversation_id)}
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{inst.instance_name || "Sem instância"}</p>
                            <p className="text-xs text-muted-foreground">
                              {msgCount} msg{msgCount !== 1 ? "s" : ""}
                              {inst.last_message_at && ` · ${format(new Date(inst.last_message_at), "dd/MM HH:mm")}`}
                            </p>
                          </div>
                          {isSelected ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      {isSelected && <InstanceMessageHistory conversationId={inst.conversation_id} />}
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ─── TAB: Agendamentos ─── */}
            <TabsContent value="reminders" className="px-6 py-5 space-y-2 mt-0">
              {isLoadingReminders ? (
                <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
              ) : reminders.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground">Nenhum agendamento</p>
                </div>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="rounded-lg border bg-card p-3 flex items-center justify-between gap-3">
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
                ))
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
