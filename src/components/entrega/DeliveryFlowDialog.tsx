import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package, QrCode, CreditCard, FileText, Copy, Check,
  User, Phone, Mail, FileDigit, ShoppingBag, ArrowLeft, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/normalizePhone";
import { generatePhoneVariations } from "@/lib/phoneNormalization";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: any;
  workspaceId: string | null;
  userId: string | undefined;
}

type Step = "phone" | "payment" | "processing" | "result";

interface LeadInfo {
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  products: string[];
}

const PAYMENT_METHODS = [
  { id: "pix", label: "PIX", desc: "Instantâneo", icon: QrCode },
  { id: "cartao", label: "Cartão", desc: "Crédito / Parcelado", icon: CreditCard },
  { id: "boleto", label: "Boleto", desc: "3 dias úteis", icon: FileText },
] as const;

export function DeliveryFlowDialog({ open, onOpenChange, product, workspaceId, userId }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

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

  const processDelivery = useCallback(async (method: string) => {
    if (!workspaceId || !userId) return;
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
      supabase.from("member_products").select("product_id, is_active").eq("workspace_id", workspaceId).in("normalized_phone", variations),
      supabase.from("delivery_products").select("id, name").eq("workspace_id", workspaceId),
    ]);

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

    const allProducts = allProductsRes.data || [];
    const memberProducts = (memberRes.data || []).filter((m) => m.is_active);
    const productNames = memberProducts
      .map((mp) => allProducts.find((p) => p.id === mp.product_id)?.name)
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
      await supabase.from("conversations").insert({
        user_id: userId,
        workspace_id: workspaceId,
        remote_jid: normalized,
        phone_number: normalized,
        contact_name: foundName || null,
      });
    }

    await supabase.from("member_products").upsert(
      { workspace_id: workspaceId, product_id: product.id, normalized_phone: normalized, is_active: true },
      { onConflict: "workspace_id,product_id,normalized_phone" }
    );

    await supabase.from("delivery_link_generations").insert({
      workspace_id: workspaceId, product_id: product.id, phone, normalized_phone: normalized, payment_method: method,
    });

    if (method === "pix") {
      await supabase.from("transactions").insert({
        user_id: userId, workspace_id: workspaceId, type: "pix", status: "aprovado",
        amount: product.value, customer_phone: normalized, customer_name: foundName || null,
        source: "entrega_digital", description: product.name, paid_at: new Date().toISOString(),
      });
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
    toast.success(method === "pix" ? "Acesso liberado + PIX registrado" : "Acesso liberado");
  }, [workspaceId, userId, phone, product, settings, qc]);

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
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-muted-foreground" />
              {product.name}
            </DialogTitle>
            <Badge variant="outline" className="text-[11px] font-normal tracking-wide">
              R$ {Number(product.value).toFixed(2)}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Liberar acesso ao produto
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="px-5 py-4">
          {/* Step 1: Phone */}
          {step === "phone" && (
            <div className="space-y-4">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefone do cliente"
                className="h-9 text-sm"
                autoFocus
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setStep("payment")}
                  disabled={!phone.trim()}
                  className="text-xs px-5"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === "payment" && (
            <div className="space-y-3">
              <button
                onClick={() => setStep("phone")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> Voltar
              </button>
              <p className="text-xs text-muted-foreground">Método de pagamento utilizado:</p>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => processDelivery(pm.id)}
                    className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-accent/50 active:scale-[0.99]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <pm.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{pm.label}</span>
                      <span className="text-xs text-muted-foreground">{pm.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Processando...</p>
            </div>
          )}

          {/* Step 4: Result */}
          {step === "result" && leadInfo && (
            <div className="space-y-4">
              {/* Lead card */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                {leadInfo.name && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{leadInfo.name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={Phone} label="Telefone" value={leadInfo.phone} />
                  {leadInfo.email && <InfoRow icon={Mail} label="Email" value={leadInfo.email} />}
                  {leadInfo.cpf && <InfoRow icon={FileDigit} label="CPF" value={leadInfo.cpf} />}
                </div>
                {leadInfo.products.length > 0 && (
                  <>
                    <Separator className="bg-border/50" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" /> Produtos com acesso
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {leadInfo.products.map((name) => (
                          <Badge key={name} variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Link */}
              <div className="rounded-md bg-muted/50 px-3 py-2.5">
                <p className="text-xs font-mono text-foreground/80 break-all whitespace-pre-wrap leading-relaxed">
                  {message}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" className="text-xs gap-1.5 flex-1" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={reset}>
                  Gerar outro
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-xs font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
