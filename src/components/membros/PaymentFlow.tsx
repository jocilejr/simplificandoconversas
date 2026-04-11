import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, FileText, QrCode, Copy, Check, Loader2, ArrowLeft, ShieldCheck, Zap, Pencil, User, AlertCircle } from "lucide-react";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  card_payment_url?: string | null;
  purchase_url?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer;
  themeColor: string;
  memberPhone: string;
  workspaceId?: string | null;
  customerName?: string;
  customerDocument?: string;
}

type Step = "select" | "pix-confirm" | "pix" | "boleto" | "boleto-success" | "error";

interface PaymentResponse {
  success: boolean;
  transaction_id?: string;
  payment_url?: string;
  qr_code?: string;
  qr_code_base64?: string;
  barcode?: string;
  type?: string;
  error?: string;
}

async function createCharge(payload: Record<string, any>): Promise<PaymentResponse> {
  const res = await fetch("/functions/v1/member-purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("Servidor retornou HTML em vez de JSON. A API pode não estar configurada.");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Erro HTTP ${res.status}`);
  }
  return data;
}

export default function PaymentFlow({ open, onOpenChange, offer, themeColor, memberPhone, workspaceId, customerName, customerDocument }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [copied, setCopied] = useState(false);
  const [boletoName, setBoletoName] = useState(customerName || "");
  const [boletoCpf, setBoletoCpf] = useState(customerDocument ? customerDocument.replace(/\D/g, "").slice(0, 11) : "");
  const [loading, setLoading] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(!!(customerName || customerDocument));
  const [editingData, setEditingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // PIX response data
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");

  // Boleto response data
  const [boletoPaymentUrl, setBoletoPaymentUrl] = useState("");

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("select"); setCopied(false); setLoading(false);
      setBoletoName(customerName || "");
      setBoletoCpf(customerDocument ? customerDocument.replace(/\D/g, "").slice(0, 11) : "");
      setHasExistingData(!!(customerName || customerDocument));
      setEditingData(false); setErrorMsg("");
      setPixQrCode(""); setPixQrCodeBase64("");
      setBoletoPaymentUrl("");
    }, 200);
  };

  useEffect(() => {
    if (customerName && !boletoName) {
      setBoletoName(customerName);
      setHasExistingData(true);
    }
  }, [customerName]);

  useEffect(() => {
    if (customerDocument) {
      const cleaned = customerDocument.replace(/\D/g, "").slice(0, 11);
      if (cleaned && !boletoCpf) {
        setBoletoCpf(cleaned);
        setHasExistingData(true);
      }
    }
  }, [customerDocument]);

  const resolvedName = boletoName || customerName || undefined;
  const resolvedDoc = boletoCpf || (customerDocument ? customerDocument.replace(/\D/g, "").slice(0, 11) : undefined);

  const basePayload = {
    phone: memberPhone,
    offer_name: offer.name,
    amount: offer.price || 0,
    workspace_id: workspaceId,
    customer_name: resolvedName,
    customer_document: resolvedDoc,
  };

  const handlePix = async () => {
    setStep("pix-loading");
    setLoading(true);
    try {
      const result = await createCharge({ ...basePayload, payment_method: "pix" });
      setPixQrCode(result.qr_code || offer.pix_key || "");
      setPixQrCodeBase64(result.qr_code_base64 || "");
      setStep("pix");
    } catch (err: any) {
      console.error("[PaymentFlow] PIX error:", err.message);
      setErrorMsg(err.message);
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleCard = async () => {
    setLoading(true);
    try {
      await createCharge({ ...basePayload, payment_method: "cartao" });
    } catch {
      // Card is just intent logging, ignore errors
    } finally {
      setLoading(false);
    }
    const url = offer.card_payment_url || offer.purchase_url;
    if (url) window.open(url, "_blank");
  };

  const handleCopyPix = async () => {
    const textToCopy = pixQrCode || offer.pix_key || "";
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCPF = (value: string) => value.replace(/\D/g, "").slice(0, 11);
  const formatCPFDisplay = (cpf: string) => {
    const d = cpf.replace(/\D/g, "");
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return d;
  };

  const submitBoleto = async () => {
    if (!boletoName.trim()) { toast.error("Nome é obrigatório"); return; }
    if (boletoCpf.length !== 11) { toast.error("CPF inválido (11 dígitos)"); return; }
    setLoading(true);
    try {
      const result = await createCharge({
        ...basePayload,
        payment_method: "boleto",
        customer_name: boletoName.trim(),
        customer_document: boletoCpf,
      });

      setBoletoPaymentUrl(result.payment_url || "");

      // Also fire boleto webhook if configured
      try {
        const sb = (await import("@/integrations/supabase/client")).supabase;
        const { data: settings } = await sb.from("manual_boleto_settings").select("webhook_url").maybeSingle();
        if (settings && (settings as any).webhook_url) {
          await fetch((settings as any).webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: boletoName.trim(), telefone: memberPhone, Valor: offer.price || 0, CPF: boletoCpf }),
          }).catch(() => {});
        }
      } catch {}

      setStep("boleto-success");
      toast.success("Boleto gerado com sucesso!");
    } catch (err: any) {
      console.error("[PaymentFlow] Boleto error:", err.message);
      setErrorMsg(err.message);
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const priceFormatted = offer.price ? `R$ ${offer.price.toFixed(2).replace(".", ",")}` : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-0 p-0 gap-0 overflow-hidden shadow-2xl bg-white [&>button]:hidden">
        <DialogTitle className="sr-only">Pagamento</DialogTitle>

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
          {step !== "select" && (
            <button onClick={() => { setStep("select"); setErrorMsg(""); }} className="text-white/80 hover:text-white transition-colors"><ArrowLeft className="h-5 w-5" /></button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{offer.name}</p>
            {priceFormatted && <p className="text-xs text-white/70">{priceFormatted}</p>}
          </div>
        </div>

        {/* Step: Select payment method */}
        {step === "select" && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600 text-center mb-1">Como deseja pagar?</p>
            {(offer.pix_key || true) && (
              <button onClick={handlePix} className="w-full flex items-center gap-4 p-4 rounded-xl border-2 hover:shadow-md transition-all text-left" style={{ borderColor: `${themeColor}30` }}>
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${themeColor}15` }}><QrCode className="h-6 w-6" style={{ color: themeColor }} /></div>
                <div className="flex-1"><div className="flex items-center gap-2"><p className="font-semibold text-gray-800 text-sm">PIX</p><span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium"><Zap className="h-2.5 w-2.5" /> Recebimento imediato</span></div><p className="text-xs text-gray-500">Pagamento instantâneo</p></div>
              </button>
            )}
            {(offer.card_payment_url || offer.purchase_url) && (
              <button onClick={handleCard} className="w-full flex items-center gap-4 p-4 rounded-xl border-2 hover:shadow-md transition-all text-left" style={{ borderColor: `${themeColor}30` }}>
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${themeColor}15` }}><CreditCard className="h-6 w-6" style={{ color: themeColor }} /></div>
                <div className="flex-1"><div className="flex items-center gap-2"><p className="font-semibold text-gray-800 text-sm">Cartão de Crédito</p><span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium">até 12x</span></div><p className="text-xs text-gray-500">Parcelamento disponível</p></div>
              </button>
            )}
            <button onClick={() => setStep("boleto")} className="w-full flex items-center gap-4 p-4 rounded-xl border-2 hover:shadow-md transition-all text-left" style={{ borderColor: `${themeColor}30` }}>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${themeColor}15` }}><FileText className="h-6 w-6" style={{ color: themeColor }} /></div>
              <div><p className="font-semibold text-gray-800 text-sm">Boleto Bancário</p><p className="text-xs text-gray-500">Vencimento em 3 dias úteis</p></div>
            </button>
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><ShieldCheck className="h-3.5 w-3.5" /> Verificado</span>
              <span className="w-px h-3 bg-gray-200" />
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><ShieldCheck className="h-3.5 w-3.5" /> Pagamento 100% seguro</span>
            </div>
          </div>
        )}

        {/* Step: PIX Loading */}
        {step === "pix-loading" && (
          <div className="p-8 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: themeColor }} />
            <p className="text-sm text-gray-600">Gerando cobrança PIX...</p>
          </div>
        )}

        {/* Step: PIX */}
        {step === "pix" && (
          <div className="p-5 space-y-4">
            <div className="text-center space-y-2">
              {pixQrCodeBase64 ? (
                <img src={pixQrCodeBase64} alt="QR Code PIX" className="mx-auto h-40 w-40 rounded-lg" />
              ) : (
                <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}><QrCode className="h-8 w-8" style={{ color: themeColor }} /></div>
              )}
              <p className="text-sm font-semibold text-gray-800">Pague via PIX</p>
              {priceFormatted && <p className="text-2xl font-bold" style={{ color: themeColor }}>{priceFormatted}</p>}
            </div>
            {pixQrCode && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs text-gray-500 font-medium">Código PIX (Copia e Cola)</p>
                <code className="text-[11px] text-gray-800 font-mono bg-white px-3 py-2 rounded-lg border break-all block max-h-20 overflow-y-auto">{pixQrCode}</code>
                <Button onClick={handleCopyPix} className="w-full mt-3 font-semibold" style={{ backgroundColor: themeColor, color: '#fff' }}>
                  {copied ? <><Check className="h-4 w-4 mr-2" /> COPIADO!</> : <><Copy className="h-4 w-4 mr-2" /> COPIAR CÓDIGO PIX</>}
                </Button>
              </div>
            )}
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${themeColor}08`, border: `1px solid ${themeColor}20` }}>
              <p className="text-sm text-gray-700 leading-relaxed">Ao efetuar o PIX, todo o material será <strong>liberado no seu WhatsApp</strong> automaticamente!</p>
            </div>
          </div>
        )}

        {/* Step: Boleto — form */}
        {step === "boleto" && (
          <div className="p-5 space-y-5">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                <FileText className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-base font-semibold text-gray-900">Gerar Boleto Bancário</p>
              {priceFormatted && <p className="text-2xl font-bold text-emerald-600 mt-1">{priceFormatted}</p>}
            </div>

            {hasExistingData && !editingData ? (
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-xl p-4 relative bg-gray-50/50">
                  <button onClick={() => setEditingData(true)} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-400 hover:text-gray-700" title="Editar dados">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <div className="space-y-3 pr-10">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><User className="h-4 w-4 text-emerald-600" /></div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest leading-none mb-0.5">Nome completo</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{boletoName}</p>
                      </div>
                    </div>
                    {boletoCpf && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-blue-600" /></div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest leading-none mb-0.5">CPF</p>
                          <p className="text-sm font-semibold text-gray-900 font-mono">{formatCPFDisplay(boletoCpf)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <Button className="w-full h-12 rounded-xl font-bold text-base text-white border-0 bg-emerald-600 hover:bg-emerald-700 transition-all" style={{ boxShadow: "0 4px 20px rgba(16,185,129,0.35)" }} onClick={submitBoleto} disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando boleto...</> : <><FileText className="h-4 w-4 mr-2" /> Gerar Boleto</>}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="boleto-name" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nome Completo</Label>
                    <Input id="boleto-name" value={boletoName} onChange={(e) => setBoletoName(e.target.value)} placeholder="Seu nome completo" className="mt-1.5 h-11 bg-white text-gray-900 border-gray-200 rounded-lg placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <Label htmlFor="boleto-cpf" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">CPF</Label>
                    <Input id="boleto-cpf" value={boletoCpf} onChange={(e) => setBoletoCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={11} className="mt-1.5 h-11 bg-white text-gray-900 border-gray-200 rounded-lg placeholder:text-gray-400 font-mono focus:border-emerald-500 focus:ring-emerald-500" />
                  </div>
                </div>
                <Button className="w-full h-12 rounded-xl font-bold text-base text-white border-0 bg-emerald-600 hover:bg-emerald-700 transition-all" style={{ boxShadow: "0 4px 20px rgba(16,185,129,0.35)" }} onClick={submitBoleto} disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando boleto...</> : <><FileText className="h-4 w-4 mr-2" /> Gerar Boleto</>}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step: Boleto — success */}
        {step === "boleto-success" && (
          <div className="p-6 text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="font-semibold text-gray-900 text-base">Boleto gerado!</p>
            <p className="text-sm text-gray-500 leading-relaxed">Você receberá os detalhes do boleto no seu WhatsApp em breve.</p>
            {boletoPaymentUrl && (
              <Button asChild className="w-full mt-2 font-semibold" style={{ backgroundColor: themeColor, color: '#fff' }}>
                <a href={boletoPaymentUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" /> Ver Boleto
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="p-6 text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <p className="font-semibold text-gray-900 text-base">Erro ao gerar cobrança</p>
            <p className="text-sm text-gray-500 leading-relaxed">{errorMsg || "Tente novamente em alguns instantes."}</p>
            <Button onClick={() => { setStep("select"); setErrorMsg(""); }} variant="outline" className="mt-2">
              Tentar novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
