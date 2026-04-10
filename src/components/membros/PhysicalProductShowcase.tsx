import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import PaymentFlow from "./PaymentFlow";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  purchase_url: string;
  price: number | null;
  category_tag: string | null;
  pix_key?: string | null;
  card_payment_url?: string | null;
}

interface Props {
  offer: Offer;
  themeColor: string;
  memberPhone?: string;
}

export default function PhysicalProductShowcase({ offer, themeColor, memberPhone }: Props) {
  const [showSalesPage, setShowSalesPage] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  return (
    <>
      <section className="py-6 px-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-medium">{offer.category_tag || "exclusivo"}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <button onClick={() => setShowSalesPage(true)} className="w-full flex items-center gap-4 rounded-xl p-3 transition-all duration-200 hover:bg-gray-50 active:scale-[0.99] text-left group">
          {offer.image_url && <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 shadow-sm"><img src={offer.image_url} alt={offer.name} className="w-full h-full object-cover" /></div>}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-semibold text-gray-700 leading-snug truncate">{offer.name}</p>
            {offer.description && <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{offer.description}</p>}
            <span className="inline-flex items-center gap-1 text-[11px] font-medium mt-1 transition-colors" style={{ color: themeColor }}>Saiba mais<ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></span>
          </div>
        </button>
      </section>

      {showSalesPage && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          <div className="relative bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => setShowSalesPage(false)} className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-gray-100 transition-colors"><X className="h-4 w-4 text-gray-600" /></button>
            {offer.image_url && <div className="w-full aspect-[4/3] overflow-hidden sm:rounded-t-2xl rounded-t-2xl"><img src={offer.image_url} alt={offer.name} className="w-full h-full object-cover" /></div>}
            <div className="p-6 space-y-4">
              {offer.category_tag && <span className="inline-block text-[10px] uppercase tracking-[0.15em] font-semibold px-2.5 py-1 rounded-full" style={{ color: themeColor, backgroundColor: `${themeColor}12` }}>{offer.category_tag}</span>}
              <h2 className="text-xl font-bold text-gray-800 leading-tight">{offer.name}</h2>
              {offer.description && <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{offer.description}</p>}
              {offer.price != null && <p className="text-lg font-bold text-gray-800">R$ {offer.price.toFixed(2).replace(".", ",")}</p>}
              <button onClick={() => { setShowSalesPage(false); setPaymentOpen(true); }} className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]" style={{ backgroundColor: themeColor }}>Quero adquirir</button>
            </div>
          </div>
        </div>
      )}

      <PaymentFlow open={paymentOpen} onOpenChange={setPaymentOpen} offer={offer} themeColor={themeColor} memberPhone={memberPhone || ""} />
    </>
  );
}
