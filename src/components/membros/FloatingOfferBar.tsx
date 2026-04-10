import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

interface Offer { id: string; name: string; description: string | null; image_url: string | null; purchase_url: string; category_tag: string | null; }
interface Props { offer: Offer; themeColor: string; onOpenChat: () => void; }

const DISMISS_KEY = "floating_offer_dismissed";
const SUBTLE_TEXTS = ["Continue sua jornada ✨", "Material complementar 📚", "Aprofunde seus estudos 🌱", "Conteúdo exclusivo 💎"];

export default function FloatingOfferBar({ offer, themeColor, onOpenChat }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { if (sessionStorage.getItem(`${DISMISS_KEY}_${offer.id}`)) { setDismissed(true); return; } } catch {}
    const handleScroll = () => { setVisible(window.scrollY > 300); };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [offer.id]);

  const handleDismiss = (e: React.MouseEvent) => { e.stopPropagation(); setDismissed(true); try { sessionStorage.setItem(`${DISMISS_KEY}_${offer.id}`, "1"); } catch {} };
  if (dismissed || !visible) return null;

  const subtleText = offer.category_tag || SUBTLE_TEXTS[Math.floor(Date.now() / 86400000) % SUBTLE_TEXTS.length];

  return (
    <div className="fixed bottom-4 left-3 right-3 z-50 max-w-lg mx-auto" style={{ animation: "floatBarIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
      <button className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl shadow-lg bg-white border active:scale-[0.98] transition-transform text-left" style={{ borderColor: `${themeColor}20`, boxShadow: `0 8px 30px ${themeColor}15, 0 2px 8px rgba(0,0,0,0.08)` }} onClick={onOpenChat}>
        {offer.image_url ? <img src={offer.image_url} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" style={{ border: `2px solid ${themeColor}30` }} /> : <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}10)` }}><Sparkles className="h-4 w-4" style={{ color: themeColor }} /></div>}
        <div className="flex-1 min-w-0"><p className="text-[12px] font-bold text-gray-800 truncate">{offer.name}</p><p className="text-[11px] text-gray-500 truncate">{subtleText}</p></div>
        <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: themeColor }}>Ver mais</span>
        <button className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors" onClick={handleDismiss} aria-label="Fechar"><X className="h-3 w-3 text-gray-500" /></button>
      </button>
      <style>{`@keyframes floatBarIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
