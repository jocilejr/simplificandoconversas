import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type Step = "customer" | "payment" | "processing" | "result";

interface LeadInfo {
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  products: string[];
}

const PAYMENT_METHODS = [
  {
    id: "pix",
    label: "PIX",
    description: "Pagamento instantâneo",
    icon: QrCode,
  },
  {
    id: "cartao",
    label: "Cartão de Crédito",
    description: "Parcelamento disponível",
    icon: CreditCard,
  },
  {
    id: "boleto",
    label: "Boleto Bancário",
    description: "Vencimento em 3 dias úteis",
    icon: FileText,
  },
] as const;

export function DeliveryFlowDialog({ open, onOpenChange, product, workspaceId, userId }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("customer");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
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

    // Parallel queries for lead info
    const [convosRes, txRes, memberRes, allProductsRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, phone_number, contact_name, email")
        .eq("workspace_id", workspaceId),
      supabase
        .from("transactions")
        .select("customer_document, customer_name, customer_email, customer_phone")
        .eq("workspace_id", workspaceId)
        .not("customer_phone", "is", null),
      supabase
        .from("member_products")
        .select("product_id, is_active")
        .eq("workspace_id", workspaceId)
        .in("normalized_phone", variations),
      supabase
        .from("delivery_products")
        .select("id, name")
        .eq("workspace_id", workspaceId),
    ]);

    // Find conversation match
    const convos = convosRes.data || [];
    let matchedConvo = convos.find((c) => normalizePhone(c.phone_number) === normalized);
    if (!matchedConvo) {
      matchedConvo = convos.find((c) => {
        const norm = normalizePhone(c.phone_number);
        return norm !== "-" && norm.slice(-8) === last8;
      });
    }

    // Find CPF from transactions
    const txs = txRes.data || [];
    let cpf: string | null = null;
    let txEmail: string | null = null;
    for (const tx of txs) {
      const txNorm = normalizePhone(tx.customer_phone);
      if (txNorm === normalized || (txNorm !== "-" && txNorm.slice(-8) === last8)) {
        cpf = tx.customer_document || null;
        txEmail = tx.customer_email || null;
        break;
      }
    }

    // Build product names from member_products
    const allProducts = allProductsRes.data || [];
    const memberProducts = (memberRes.data || []).filter((m) => m.is_active);
    const productNames = memberProducts
      .map((mp) => allProducts.find((p) => p.id === mp.product_id)?.name)
      .filter(Boolean) as string[];

    const info: LeadInfo = {
      name: matchedConvo?.contact_name || customerName,
      phone: normalized,
      cpf,
      email: matchedConvo?.email || txEmail || null,
      products: productNames,
    };
    setLeadInfo(info);

    // Create conversation if not found
    if (!matchedConvo) {
      await supabase.from("conversations").insert({
        user_id: userId,
        workspace_id: workspaceId,
        remote_jid: normalized,
        phone_number: normalized,
        contact_name: customerName,
      });
    }

    // Grant access
    await supabase.from("member_products").upsert(
      {
        workspace_id: workspaceId,
        product_id: product.id,
        normalized_phone: normalized,
        is_active: true,
      },
      { onConflict: "workspace_id,product_id,normalized_phone" }
    );

    // Log link generation
    await supabase.from("delivery_link_generations").insert({
      workspace_id: workspaceId,
      product_id: product.id,
      phone,
      normalized_phone: normalized,
      payment_method: method,
    });

    // If PIX, create approved transaction
    if (method === "pix") {
      await supabase.from("transactions").insert({
        user_id: userId,
        workspace_id: workspaceId,
        type: "pix",
        status: "aprovado",
        amount: product.value,
        customer_phone: normalized,
        customer_name: customerName,
        source: "entrega_digital",
        description: product.name,
        paid_at: new Date().toISOString(),
      });
    }

    // Build link
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
        ? "Acesso liberado + pagamento PIX registrado"
        : "Acesso liberado com sucesso"
    );
  }, [workspaceId, userId, phone, customerName, product, settings, qc]);

  const handlePaymentSelect = (method: string) => {
    setPaymentMethod(method);
    processDelivery(method);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Mensagem copiada!");
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setStep("customer");
      setCustomerName("");
      setPhone("");
      setPaymentMethod("");
      setLeadInfo(null);
      setLink("");
      setMessage("");
      setCopied(false);
    }
    onOpenChange(o);
  };

  const reset = () => {
    setStep("customer");
    setCustomerName("");
    setPhone("");
    setPaymentMethod("");
    setLeadInfo(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> {product.name}
            <Badge variant="outline" className="ml-auto text-xs font-normal">
              R$ {Number(product.value).toFixed(2)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Customer Data */}
        {step === "customer" && (
          <div className="space-y-4">
            <div>
              <Label>Nome do Cliente</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome completo"
                autoFocus
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11999999999"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => setStep("payment")}
              disabled={!customerName.trim() || !phone.trim()}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 2: Payment Method Cards */}
        {step === "payment" && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2 text-muted-foreground"
              onClick={() => setStep("customer")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
            <p className="text-sm text-muted-foreground">
              Selecione o método de pagamento utilizado:
            </p>
            <div className="grid gap-3">
              {PAYMENT_METHODS.map((pm) => (
                <Card
                  key={pm.id}
                  className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
                  onClick={() => handlePaymentSelect(pm.id)}
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <pm.icon className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{pm.label}</p>
                      <p className="text-sm text-muted-foreground">{pm.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processando acesso...</p>
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && leadInfo && (
          <div className="space-y-4">
            {/* Lead Info Card */}
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-primary" />
                  {leadInfo.name}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="truncate">{leadInfo.phone}</span>
                  </div>
                  {leadInfo.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{leadInfo.email}</span>
                    </div>
                  )}
                  {leadInfo.cpf && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileDigit className="h-3.5 w-3.5" />
                      <span>{leadInfo.cpf}</span>
                    </div>
                  )}
                </div>
                {leadInfo.products.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" /> Produtos com acesso
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {leadInfo.products.map((name) => (
                          <Badge key={name} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Link */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-mono break-all whitespace-pre-wrap">{message}</p>
            </div>

            <Button className="w-full" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Copiado!" : "Copiar Mensagem"}
            </Button>
            <Button variant="outline" className="w-full" onClick={reset}>
              Gerar outro link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
