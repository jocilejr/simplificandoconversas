import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, QrCode, CreditCard, FileText, Copy, Check,
  User, Phone, Mail, FileDigit, ShoppingBag, ArrowLeft, ArrowRight,
  Loader2, X, CircleDot, Calendar, Hash, Search, BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/normalizePhone";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: any;
  workspaceId: string | null;
  userId: string | undefined;
}

type Step = "phone" | "payment" | "select-tx" | "processing" | "result";

interface LeadInfo {
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  products: string[];
}

interface OrphanTx {
  id: string;
  amount: number;
  customer_name: string | null;
  customer_document: string | null;
  customer_phone: string | null;
  created_at: string;
  paid_at: string | null;
}

const STEPS_META = [
  { key: "phone", label: "Telefone" },
  { key: "payment", label: "Pagamento" },
  { key: "result", label: "Resultado" },
] as const;

const PAYMENT_METHODS = [
  { id: "pix", label: "PIX", desc: "Instantâneo", icon: QrCode },
  { id: "cartao", label: "Cartão", desc: "Crédito / Parcelado", icon: CreditCard },
  { id: "boleto", label: "Boleto", desc: "3 dias úteis", icon: FileText },
] as const;

function StepIndicator({ current }: { current: Step }) {
  const idx = current === "processing" ? 2 : current === "select-tx" ? 1 : STEPS_META.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-1.5">
      {STEPS_META.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= idx
                ? "w-6 bg-primary"
                : "w-1.5 bg-muted-foreground/20"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

export function DeliveryFlowDialog({ open, onOpenChange, product, workspaceId, userId }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [orphanTxs, setOrphanTxs] = useState<OrphanTx[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [txSearch, setTxSearch] = useState("");
  const [txLimit, setTxLimit] = useState(5);
  const [leadCpf, setLeadCpf] = useState<string | null>(null);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
    return fallback;
  };

  const { data: settings } = useQuery({
    queryKey: ["delivery-settings", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_settings")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return data;
    },
  });

  const handlePixClick = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingTxs(true);

    // 1) Resolve lead's CPF from existing transactions with this phone
    const normalized = normalizePhone(phone);
    const last8 = normalized !== "-" ? normalized.slice(-8) : "";
    let foundCpf: string | null = null;
    if (normalized !== "-") {
      const { data: phoneTxs } = await supabase
        .from("transactions")
        .select("customer_document, customer_phone")
        .eq("workspace_id", workspaceId)
        .not("customer_phone", "is", null)
        .not("customer_document", "is", null)
        .limit(100);
      
      for (const t of phoneTxs || []) {
        const tNorm = normalizePhone(t.customer_phone);
        if (tNorm === normalized || (tNorm !== "-" && last8 && tNorm.slice(-8) === last8)) {
          foundCpf = t.customer_document;
          break;
        }
      }
    }
    setLeadCpf(foundCpf);

    // 2) Fetch all approved PIX transactions
    const { data, error } = await supabase
      .from("transactions")
      .select("id, amount, customer_name, customer_document, customer_phone, created_at, paid_at, type")
      .eq("workspace_id", workspaceId)
      .in("type", ["pix", "pix_openpix", "openpix"])
      .eq("status", "aprovado")
      .order("paid_at", { ascending: false, nullsFirst: false });
    setLoadingTxs(false);

    if (error) {
      toast.error("Erro ao buscar transações");
      return;
    }

    const txs = (data || []) as OrphanTx[];
    if (txs.length === 0) {
      toast.error("Nenhuma transação PIX aprovada encontrada");
      return;
    }

    setOrphanTxs(txs);
    setTxSearch("");
    setTxLimit(10);
    setStep("select-tx");
  }, [workspaceId, phone]);

  const filteredTxs = useMemo(() => {
    const normalized = normalizePhone(phone);
    const classifyTx = (tx: OrphanTx) => {
      if (!tx.customer_phone) return "orphan";
      const txPhoneNorm = normalizePhone(tx.customer_phone);
      const isCurrentLead = txPhoneNorm === normalized ||
        (txPhoneNorm !== "-" && normalized !== "-" && txPhoneNorm.slice(-8) === normalized.slice(-8));
      if (isCurrentLead) return "current_lead";
      return "other_lead";
    };

    if (!txSearch.trim()) {
      // No search: show ALL transactions in chronological order (paid_at DESC from query)
      // Badges still classify each tx visually, but order is NOT changed
      return orphanTxs.slice(0, txLimit);
    }
    // Search: filter all txs
    const q = txSearch.toLowerCase();
    return orphanTxs.filter(
      (tx) =>
        tx.customer_name?.toLowerCase().includes(q) ||
        tx.customer_document?.includes(q)
    );
  }, [orphanTxs, txSearch, txLimit, leadCpf, phone]);

  const totalVisible = useMemo(() => orphanTxs.length, [orphanTxs]);
  const hasMoreVisible = !txSearch.trim() && txLimit < totalVisible;

  const processDelivery = useCallback(async (method: string, existingTxId?: string, alreadyCounted?: boolean) => {
    try {
      if (!workspaceId || !userId) throw new Error("Sem workspace");
      const normalized = normalizePhone(phone);
      if (normalized === "-" || normalized.length < 10) {
        toast.error("Telefone inválido");
        return;
      }

      setStep("processing");
      const variations = generatePhoneVariations(phone);
      const last8 = normalized.slice(-8);

      const [convosRes, txRes, memberRes, allProductsRes] = await Promise.all([
        supabase.from("conversations").select("id, phone_number, contact_name, email").eq("workspace_id", workspaceId),
        supabase.from("transactions").select("customer_document, customer_name, customer_email, customer_phone").eq("workspace_id", workspaceId).not("customer_phone", "is", null),
        supabase.from("member_products" as any).select("product_id, is_active").eq("workspace_id", workspaceId).in("phone", variations),
        supabase.from("delivery_products").select("id, name").eq("workspace_id", workspaceId),
      ]);

      if (convosRes.error) throw convosRes.error;
      if (txRes.error) throw txRes.error;
      if (memberRes.error) throw memberRes.error;
      if (allProductsRes.error) throw allProductsRes.error;

      const convos = convosRes.data || [];
      let matchedConvo = convos.find((c) => normalizePhone(c.phone_number) === normalized);
      if (!matchedConvo) {
        matchedConvo = convos.find((c) => {
          const norm = normalizePhone(c.phone_number);
          return norm !== "-" && norm.slice(-8) === last8;
        });
      }

      const txs = txRes.data || [];
      let cpf: string | null = null;
      let txEmail: string | null = null;
      let txName: string | null = null;
      for (const tx of txs) {
        const txNorm = normalizePhone(tx.customer_phone);
        if (txNorm === normalized || (txNorm !== "-" && txNorm.slice(-8) === last8)) {
          cpf = tx.customer_document || null;
          txEmail = tx.customer_email || null;
          txName = tx.customer_name || null;
          break;
        }
      }

      let selectedTx: OrphanTx | undefined;
      if (method === "pix" && existingTxId) {
        selectedTx = orphanTxs.find((t) => t.id === existingTxId);
        if (selectedTx) {
          if (!cpf && selectedTx.customer_document) cpf = selectedTx.customer_document;
          if (!txName && selectedTx.customer_name) txName = selectedTx.customer_name;
        }
      }

      const allProducts = allProductsRes.data || [];
      const memberProducts = ((memberRes.data || []) as any[]).filter((m: any) => m.is_active);
      const productNames = memberProducts
        .map((mp: any) => allProducts.find((p) => p.id === mp.product_id)?.name)
        .filter(Boolean) as string[];

      const foundName = matchedConvo?.contact_name || txName || "";

      const info: LeadInfo = {
        name: foundName,
        phone: normalized,
        cpf,
        email: matchedConvo?.email || txEmail || null,
        products: productNames,
      };
      setLeadInfo(info);

      if (!matchedConvo) {
        const { error: conversationInsertError } = await supabase.from("conversations").insert({
          user_id: userId,
          workspace_id: workspaceId,
          remote_jid: normalized,
          phone_number: normalized,
          contact_name: foundName || null,
        });
        if (conversationInsertError) throw conversationInsertError;
      }

      const { error: memberProductError } = await supabase.from("member_products").upsert(
        { workspace_id: workspaceId, product_id: product.id, phone: normalized, is_active: true } as any,
        { onConflict: "product_id,phone" }
      );
      if (memberProductError) throw memberProductError;

      const { error: generationError } = await supabase.from("delivery_link_generations").insert({
        workspace_id: workspaceId, product_id: product.id, phone, normalized_phone: normalized, payment_method: method,
      });
      if (generationError) throw generationError;

      if (method === "pix" && existingTxId && !alreadyCounted) {
        const { error: transactionUpdateError } = await supabase
          .from("transactions")
          .update({
            customer_phone: normalized,
            description: product.name,
            source: "entrega_digital",
          })
          .eq("id", existingTxId);

        if (transactionUpdateError) throw transactionUpdateError;
      }

      const domain = (settings as any)?.custom_domain || window.location.origin;
      const finalLink = `${domain.replace(/\/$/, "")}/${normalized}`;
      const deliveryMsg = (settings as any)?.delivery_message;
      const finalMessage = deliveryMsg ? `${deliveryMsg}\n\n${finalLink}` : finalLink;
      setLink(finalLink);
      setMessage(finalMessage);

      qc.invalidateQueries({ queryKey: ["delivery-link-generations"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });

      setStep("result");
      toast.success(
        method === "pix"
          ? alreadyCounted
            ? "Acesso liberado (transação já contabilizada no lead)"
            : "Acesso liberado + PIX vinculado"
          : "Acesso liberado"
      );
    } catch (error) {
      setStep(method === "pix" && existingTxId ? "select-tx" : "payment");
      toast.error(getErrorMessage(error, "Erro ao liberar acesso"));
    }
  }, [workspaceId, userId, phone, product, settings, qc, orphanTxs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const reset = () => {
    setStep("phone");
    setPhone("");
    setLeadInfo(null);
    setLink("");
    setMessage("");
    setCopied(false);
    setOrphanTxs([]);
    setTxSearch("");
    setTxLimit(5);
    setLeadCpf(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden rounded-xl border-border/60 [&>button]:hidden">
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border/40">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-3.5 w-3.5 text-primary" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight truncate">{product.name}</h2>
            </div>
            <div className="flex items-center gap-3 pl-9">
              <span className="text-[11px] text-muted-foreground font-mono">/{product.slug}</span>
              <StepIndicator current={step} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <span className="text-xs font-mono font-medium text-foreground/80 bg-muted/60 px-2.5 py-1 rounded-md">
              R$ {Number(product.value).toFixed(2)}
            </span>
            <button
              onClick={() => handleClose(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-6 py-5 min-h-[220px]">
          {/* Step: Phone */}
          {step === "phone" && (
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Telefone do cliente</p>
                <p className="text-[11px] text-muted-foreground">
                  Informe o número para liberar o acesso ao produto
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-9 text-sm pl-9 bg-muted/30 border-border/50 focus:bg-background"
                    autoFocus
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => setStep("payment")}
                  disabled={!phone.trim()}
                  className="h-9 px-4 text-xs gap-1"
                >
                  Continuar
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Step: Payment */}
          {step === "payment" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep("phone")}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </button>
                <span className="text-[11px] text-muted-foreground font-mono">{phone}</span>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Método de pagamento</p>
                <p className="text-[11px] text-muted-foreground">
                  Selecione como o cliente realizou o pagamento
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    disabled={loadingTxs}
                    onClick={() => {
                      if (pm.id === "pix") {
                        handlePixClick();
                      } else {
                        processDelivery(pm.id);
                      }
                    }}
                    className="group relative flex flex-col items-center gap-2.5 rounded-xl border border-border/50 bg-card p-5 text-center transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 hover:shadow-sm active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 group-hover:bg-primary/10 transition-colors">
                      {loadingTxs && pm.id === "pix" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <pm.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{pm.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pm.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Select TX */}
          {step === "select-tx" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep("payment")}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar
                </button>
                <span className="text-[11px] text-muted-foreground font-mono">{phone}</span>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Selecionar transação PIX</p>
                <p className="text-[11px] text-muted-foreground">
                  Escolha a transação que será vinculada a este contato
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  value={txSearch}
                  onChange={(e) => { setTxSearch(e.target.value); setTxLimit(5); }}
                  placeholder="Buscar por nome ou CPF..."
                  className="h-8 text-xs pl-9 bg-muted/30 border-border/50 focus:bg-background"
                />
              </div>

              <p className="text-[10px] text-muted-foreground">
                {txSearch.trim()
                  ? `${filteredTxs.length} transações encontradas`
                  : `${totalVisible} transações disponíveis`}
              </p>

              <ScrollArea className="h-[calc(70vh-200px)]">
                <div className="space-y-2 pr-2">
                  {filteredTxs.map((tx) => {
                    const isLinked = !!tx.customer_phone;
                    const normalized = normalizePhone(phone);
                    const txPhoneNorm = normalizePhone(tx.customer_phone);
                    const isLinkedToCurrentLead = isLinked && (
                      txPhoneNorm === normalized ||
                      (txPhoneNorm !== "-" && normalized !== "-" && txPhoneNorm.slice(-8) === normalized.slice(-8))
                    );
                    // Already counted: CPF matches AND (orphan OR linked to current lead)
                    const isAlreadyCounted = !!leadCpf && tx.customer_document === leadCpf && (isLinkedToCurrentLead || !isLinked);
                    // Disabled: linked to a DIFFERENT contact
                    const isDisabled = isLinked && !isLinkedToCurrentLead;
                    return (
                      <button
                        key={tx.id}
                        disabled={isDisabled}
                        onClick={() => {
                          if (isAlreadyCounted) {
                            processDelivery("pix", tx.id, true);
                          } else if (!isLinked) {
                            processDelivery("pix", tx.id, false);
                          }
                        }}
                        className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                          isDisabled
                            ? "border-border/30 bg-muted/30 opacity-60 cursor-default"
                            : isAlreadyCounted
                              ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                              : "border-border/50 bg-card hover:border-primary/40 hover:bg-accent/30"
                        }`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                          isDisabled ? "bg-blue-500/10" : isAlreadyCounted ? "bg-emerald-500/10" : "bg-emerald-500/10"
                        }`}>
                          {isDisabled ? (
                            <BadgeCheck className="h-4 w-4 text-blue-500" />
                          ) : isAlreadyCounted ? (
                            <BadgeCheck className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <QrCode className="h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-foreground">
                                R$ {Number(tx.amount).toFixed(2)}
                              </p>
                              {isAlreadyCounted && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                  Já contabilizada
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ...{tx.id.slice(-8)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {tx.customer_name && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                <User className="h-2.5 w-2.5 shrink-0" />
                                {tx.customer_name}
                                {isDisabled && <BadgeCheck className="h-2.5 w-2.5 text-blue-500 shrink-0" />}
                              </span>
                            )}
                            {tx.customer_document && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <FileDigit className="h-2.5 w-2.5 shrink-0" />
                                {tx.customer_document}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-auto shrink-0">
                              <Calendar className="h-2.5 w-2.5" />
                              {format(new Date(tx.paid_at || tx.created_at), "dd/MM HH:mm")}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {hasMoreVisible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTxLimit((l) => l + 5)}
                      className="w-full h-8 text-xs text-muted-foreground"
                    >
                      Ver mais
                    </Button>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step: Processing */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
              <div className="text-center space-y-0.5">
                <p className="text-xs font-medium text-foreground/80">Processando</p>
                <p className="text-[10px] text-muted-foreground">Buscando dados do lead e liberando acesso...</p>
              </div>
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && leadInfo && (
            <div className="space-y-4">
              {/* Lead info */}
              <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CircleDot className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">
                    Acesso liberado
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {leadInfo.name && (
                    <InfoItem icon={User} label="Nome" value={leadInfo.name} />
                  )}
                  <InfoItem icon={Phone} label="Telefone" value={leadInfo.phone} />
                  {leadInfo.email && (
                    <InfoItem icon={Mail} label="Email" value={leadInfo.email} />
                  )}
                  {leadInfo.cpf && (
                    <InfoItem icon={FileDigit} label="CPF" value={leadInfo.cpf} />
                  )}
                </div>

                {leadInfo.products.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                      <ShoppingBag className="h-2.5 w-2.5" /> Produtos com acesso
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {leadInfo.products.map((name) => (
                        <Badge key={name} variant="secondary" className="text-[10px] font-normal px-2 py-0 h-5 rounded-md">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Link / message */}
              <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Mensagem de entrega
                </p>
                <p className="text-xs font-mono text-foreground/80 break-all whitespace-pre-wrap leading-relaxed">
                  {message}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 text-xs gap-1.5 px-4"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copiado" : "Copiar mensagem"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-8 text-xs text-muted-foreground"
                >
                  Nova liberação
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-3 w-3 text-muted-foreground/60 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-xs font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
