import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, FileText, QrCode, Copy, Check, Loader2, ArrowLeft, ShieldCheck, Zap } from "lucide-react";

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
}

type Step = "select" | "pix" | "boleto";

export default function PaymentFlow({ open, onOpenChange, offer, themeColor, memberPhone }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [copied, setCopied] = useState(false);
  const [pixSent, setPixSent] = useState(false);
  const [boletoName, setBoletoName] = useState("");
  const [boletoCpf, setBoletoCpf] = useState("");
  const [boletoLoading, setBoletoLoading] = useState(false);
  const [boletoSent, setBoletoSent] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setStep("select"); setCopied(false); setPixSent(false); setBoletoName(""); setBoletoCpf(""); setBoletoLoading(false); setBoletoSent(false); }, 200);
  };

  const trackPaymentStarted = async (method: string) => {
    try {
      await supabase.from("member_offer_impressions" as any).upsert({
        normalized_phone: memberPhone.replace(/\D/g, ""),
        offer_id: offer.id,
        payment_started: true,
        payment_method: method,
      }, { onConflict: "normalized_phone,offer_id" });
    } catch { /* silent */ }
  };

  const handlePix = async () => {
    setStep("pix");
    trackPaymentStarted("pix");
    if (pixSent) return;
    try {
      await supabase.functions.invoke("member-purchase", {
        body: { phone: memberPhone, offer_name: offer.name, payment_method: "pix", amount: offer.price || 0 },
      });
      setPixSent(true);
    } catch { console.error("Error creating pix transaction"); }
  };

  const handleCard = () => {
    trackPaymentStarted("cartao");
    const url = offer.card_payment_url || offer.purchase_url;
    if (url) window.open(url, "_blank");
  };

  const handleCopyPix = async () => {
    if (!offer.pix_key) return;
    await navigator.clipboard.writeText(offer.pix_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCPF = (value: string) => value.replace(/\D/g, "").slice(0, 11);

  const submitBoleto = async () => {
    if (!boletoName.trim()) { toast.error("Nome é obrigatório"); return; }
    if (boletoCpf.length !== 11) { toast.error("CPF inválido (11 dígitos)"); return; }
    setBoletoLoading(true);
    try {
      const { data: settings } = await supabase.from("manual_boleto_settings").select("webhook_url").maybeSingle();
      if (!settings || !(settings as any).webhook_url) { toast.error("Boleto não configurado no momento"); setBoletoLoading(false); return; }
      const response = await fetch((settings as any).webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: boletoName.trim(), telefone: memberPhone, Valor: offer.price || 0, CPF: boletoCpf }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setBoletoSent(true);
      toast.success("Boleto solicitado com sucesso!");
    } catch { toast.error("Erro ao gerar boleto"); }
    finally { setBoletoLoading(false); }
  };

  const priceFormatted = offer.price ? `R$ ${offer.price.toFixed(2).replace(".", ",")}` : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-0 p-0 gap-0 overflow-hidden shadow-2xl bg-white [&>button]:hidden">
        <DialogTitle className="sr-only">Pagamento</DialogTitle>
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
          {step !== "select" && (
            <button onClick={() => setStep("select")} className="text-white/80 hover:text-white transition-colors"><ArrowLeft className="h-5 w-5" /></button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{offer.name}</p>
            {priceFormatted && <p className="text-xs text-white/70">{priceFormatted}</p>}
          </div>
        </div>

        {step === "select" && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600 text-center mb-1">Como deseja pagar?</p>
            {offer.pix_key && (
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
            <button onClick={() => { setStep("boleto"); trackPaymentStarted("boleto"); }} className="w-full flex items-center gap-4 p-4 rounded-xl border-2 hover:shadow-md transition-all text-left" style={{ borderColor: `${themeColor}30` }}>
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

        {step === "pix" && (
          <div className="p-5 space-y-4">
            <div className="text-center space-y-2">
              <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}><QrCode className="h-8 w-8" style={{ color: themeColor }} /></div>
              <p className="text-sm font-semibold text-gray-800">Pague via PIX</p>
              {priceFormatted && <p className="text-2xl font-bold" style={{ color: themeColor }}>{priceFormatted}</p>}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs text-gray-500 font-medium">Chave PIX ({offer.pix_key_type === "cpf" ? "CPF" : offer.pix_key_type === "email" ? "E-mail" : offer.pix_key_type === "cnpj" ? "CNPJ" : offer.pix_key_type === "aleatoria" ? "Chave aleatória" : "Telefone"})</p>
              <code className="text-sm text-gray-800 font-mono bg-white px-3 py-2 rounded-lg border break-all block">{offer.pix_key}</code>
              <Button onClick={handleCopyPix} className="w-full mt-3 font-semibold" style={{ backgroundColor: themeColor, color: '#fff' }}>
                {copied ? <><Check className="h-4 w-4 mr-2" /> COPIADO!</> : <><Copy className="h-4 w-4 mr-2" /> COPIAR CHAVE PIX</>}
              </Button>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${themeColor}08`, border: `1px solid ${themeColor}20` }}>
              <p className="text-sm text-gray-700 leading-relaxed">✨ Ao efetuar o PIX, todo o material será <strong>liberado no seu WhatsApp</strong> automaticamente!</p>
            </div>
          </div>
        )}

        {step === "boleto" && !boletoSent && (
          <div className="p-5 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-gray-800">Gerar Boleto</p>
              {priceFormatted && <p className="text-lg font-bold" style={{ color: themeColor }}>{priceFormatted}</p>}
            </div>
            <div className="space-y-3">
              <div><Label htmlFor="boleto-name" className="text-xs text-gray-700">Nome Completo *</Label><Input id="boleto-name" value={boletoName} onChange={(e) => setBoletoName(e.target.value)} placeholder="Seu nome completo" className="mt-1 bg-white text-gray-900 border-gray-300 placeholder:text-gray-400" /></div>
              <div><Label htmlFor="boleto-cpf" className="text-xs text-gray-700">CPF *</Label><Input id="boleto-cpf" value={boletoCpf} onChange={(e) => setBoletoCpf(formatCPF(e.target.value))} placeholder="12345678901" maxLength={11} className="mt-1 bg-white text-gray-900 border-gray-300 placeholder:text-gray-400" /></div>
            </div>
            <Button className="w-full h-12 rounded-xl font-bold text-white border-0" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`, boxShadow: `0 4px 20px ${themeColor}40` }} onClick={submitBoleto} disabled={boletoLoading}>
              {boletoLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</> : "Gerar Boleto"}
            </Button>
          </div>
        )}

        {step === "boleto" && boletoSent && (
          <div className="p-5 text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center"><Check className="h-8 w-8 text-green-600" /></div>
            <p className="font-semibold text-gray-800">Boleto solicitado!</p>
            <p className="text-sm text-gray-500">Você receberá os detalhes do boleto no seu WhatsApp em breve.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
