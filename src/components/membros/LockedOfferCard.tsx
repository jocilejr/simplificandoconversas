import { useState, useRef, useEffect, useCallback } from "react";
import { Lock } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import PaymentFlow from "./PaymentFlow";
import meirePhoto from "@/assets/meire-rosana.png";

interface Offer { id: string; name: string; description: string | null; image_url: string | null; purchase_url: string; price: number | null; category_tag: string | null; pix_key?: string | null; card_payment_url?: string | null; product_id?: string | null; }
interface MemberProfile { memberSince: string | null; totalPaid: number; totalTransactions: number; totalProducts: number; daysSinceLastAccess: number | null; }
interface Props { offer: Offer; themeColor: string; ownedProductNames?: string[]; ownedProductIds?: string[]; firstName?: string; memberProfile?: MemberProfile | null; memberPhone?: string; workspaceId?: string | null; }
type ChatBubble = { type: "text"; content: string } | { type: "image"; url: string };

const BUBBLE_DELAY_MS = 10000;

export default function LockedOfferCard({ offer, themeColor, ownedProductNames, ownedProductIds, firstName, memberProfile, memberPhone, workspaceId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showDots, setShowDots] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const pitchCache = useRef<Record<string, { bubbles: ChatBubble[] }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const el = scrollRef.current; if (!el) return; requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }); }, [visibleCount, showDots, aiLoading]);

  useEffect(() => {
    if (bubbles.length === 0 || visibleCount >= bubbles.length) return;
    if (visibleCount === 0) { setVisibleCount(1); return; }
    setShowDots(true);
    const t = setTimeout(() => { setShowDots(false); setVisibleCount(prev => prev + 1); }, BUBBLE_DELAY_MS);
    return () => clearTimeout(t);
  }, [bubbles, visibleCount]);

  useEffect(() => {
    if (bubbles.length > 0 && visibleCount >= bubbles.length && !aiLoading) { const t = setTimeout(() => setCtaVisible(true), 500); return () => clearTimeout(t); }
  }, [visibleCount, bubbles.length, aiLoading]);

  const handleOpen = useCallback(async () => {
    setDialogOpen(true); setVisibleCount(0); setCtaVisible(false); setShowDots(true);
    supabase.rpc("increment_offer_click", { offer_id: offer.id }).then(() => {});
    if (memberPhone) { supabase.from("member_offer_impressions").upsert({ normalized_phone: memberPhone, offer_id: offer.id, clicked: true, last_shown_at: new Date().toISOString() } as any, { onConflict: "normalized_phone,offer_id" }).then(() => {}); }
    if (pitchCache.current[offer.id]) { setBubbles(pitchCache.current[offer.id].bubbles); setAiLoading(false); return; }
    setAiLoading(true);
    try {
      let offerMaterialNames: string[] = [];
      if (offer.product_id) {
        const [catsRes, matsRes] = await Promise.all([
          supabase.from("member_product_categories").select("id, name").eq("product_id", offer.product_id).order("sort_order"),
          supabase.from("member_product_materials").select("title, category_id").eq("product_id", offer.product_id).order("sort_order"),
        ]);
        const cats = catsRes.data || []; const mats = matsRes.data || [];
        const catMap = new Map(cats.map((c: any) => [c.id, c.name]));
        const grouped: Record<string, string[]> = {};
        mats.forEach((m: any) => { const catName = m.category_id ? (catMap.get(m.category_id) || "Outros") : "Outros"; if (!grouped[catName]) grouped[catName] = []; grouped[catName].push(m.title); });
        offerMaterialNames = Object.entries(grouped).map(([cat, titles]) => `${cat}: ${titles.join(", ")}`);
      }

      const res = await fetch("/api/member-access/offer-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName || "Querido(a)", offerName: offer.name, offerDescription: offer.description, offerPrice: offer.price, ownedProductNames, ownedProductIds, profile: memberProfile, offerMaterials: offerMaterialNames, workspaceId }),
      });
      const data = res.ok ? await res.json() : null;

      if (data?.messages && Array.isArray(data.messages)) {
        const msgs = data.messages as string[]; const productImageUrl = data.productImageUrl as string | null;
        const allBubbles: ChatBubble[] = [{ type: "text", content: msgs[0] }, { type: "text", content: msgs[1] }];
        if (productImageUrl) allBubbles.push({ type: "image", url: productImageUrl });
        if (msgs[2]) allBubbles.push({ type: "text", content: msgs[2] });
        setBubbles(allBubbles); pitchCache.current[offer.id] = { bubbles: allBubbles };
      }
    } catch {} setAiLoading(false);
  }, [offer, firstName, ownedProductNames, ownedProductIds, memberProfile, memberPhone]);

  const handleClose = () => { setDialogOpen(false); setVisibleCount(0); setShowDots(false); setCtaVisible(false); };
  const timeStr = `${new Date().getHours().toString().padStart(2, "0")}:${new Date().getMinutes().toString().padStart(2, "0")}`;

  return (
    <>
      <div
        className="w-full rounded-2xl overflow-hidden shadow-[0_2px_12px_-2px_rgba(0,0,0,0.12),0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.18),0_8px_30px_-6px_rgba(0,0,0,0.12)] transition-all duration-300 active:scale-[0.98] group relative bg-white border border-gray-100 cursor-pointer"
        onClick={handleOpen}
      >
        {offer.image_url ? (
          <div className="relative h-[120px] w-full overflow-hidden">
            <img src={offer.image_url} alt={offer.name} className="w-full h-full object-cover scale-105" style={{ filter: "blur(3px)" }} />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white/90 bg-black/40 backdrop-blur-sm">
                <Lock className="h-3 w-3" /> Bloqueado
              </span>
            </div>
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
              <h3 className="font-bold text-white text-sm leading-tight line-clamp-2 flex-1" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>{offer.name}</h3>
              <button
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full text-white shadow-sm hover:shadow-md transition-shadow"
                style={{ backgroundColor: themeColor }}
                onClick={(e) => { e.stopPropagation(); handleOpen(); }}
              >
                Desbloquear
              </button>
            </div>
          </div>
        ) : (
          <div className="relative h-[120px] w-full flex flex-col justify-end p-4" style={{ background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 50%, ${themeColor}12 100%)` }}>
            <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 opacity-[0.07]" style={{ color: themeColor }} />
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-gray-500 bg-gray-100">
                <Lock className="h-3 w-3" /> Bloqueado
              </span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2 flex-1">{offer.name}</h3>
              <button
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full text-white shadow-sm hover:shadow-md transition-shadow"
                style={{ backgroundColor: themeColor }}
                onClick={(e) => { e.stopPropagation(); handleOpen(); }}
              >
                Desbloquear
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl bg-white">
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
            <div className="relative">
              <img src={meirePhoto} alt="Meire Rosana" className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30" />
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-400 ring-2 ring-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white drop-shadow-sm">Meire Rosana</p>
              <p className="text-[11px] text-white/70 font-medium">{aiLoading && visibleCount === 0 ? "digitando..." : "online"}</p>
            </div>
          </div>
          <div ref={scrollRef} className="px-3 py-4 space-y-2.5 min-h-[200px] max-h-[420px] overflow-y-auto bg-gray-50/80">
            {bubbles.slice(0, visibleCount).map((bubble, i) => (
              <div key={i} className="flex items-end gap-2" style={{ animation: "chatBubbleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                {i === 0 ? <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" /> : <div className="h-7 w-7 shrink-0" />}
                {bubble.type === "text" ? (
                  <div className="px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed max-w-[82%] shadow-sm text-gray-700 bg-white" style={{ borderTopLeftRadius: i === 0 ? "4px" : undefined }}>
                    {bubble.content}<span className="block text-[10px] text-gray-400 text-right mt-1 -mb-0.5">{timeStr}</span>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden shadow-sm max-w-[82%] bg-white" style={{ borderTopLeftRadius: "4px" }}>
                    <img src={bubble.url} alt="Material" className="w-full max-h-[200px] object-cover" />
                    <div className="px-2 py-1"><span className="block text-[10px] text-gray-400 text-right">{timeStr}</span></div>
                  </div>
                )}
              </div>
            ))}
            {showDots && (
              <div className="flex items-end gap-2" style={{ animation: "chatBubbleIn 0.2s ease-out forwards" }}>
                {visibleCount === 0 ? <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" /> : <div className="h-7 w-7 shrink-0" />}
                <div className="flex items-center gap-[5px] px-4 py-3 rounded-2xl rounded-tl-md shadow-sm bg-white">
                  {[0, 1, 2].map(i => <span key={i} className="inline-block h-[6px] w-[6px] rounded-full bg-gray-300" style={{ animation: `dotBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}
                </div>
              </div>
            )}
            {!aiLoading && !showDots && bubbles.length === 0 && (
              <div className="flex items-end gap-2" style={{ animation: "chatBubbleIn 0.3s ease-out forwards" }}>
                <img src={meirePhoto} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 mb-0.5" />
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13.5px] leading-relaxed max-w-[82%] shadow-sm text-gray-700 bg-white">
                  {offer.description || `${offer.name} é um material muito especial que preparamos com carinho.`}
                </div>
              </div>
            )}
          </div>
          {ctaVisible && (
            <div className="px-4 pb-4 pt-1 bg-white" style={{ animation: "chatBubbleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
              <Button
                className="w-full h-12 rounded-xl font-bold text-white text-sm border-0"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`, boxShadow: `0 4px 20px ${themeColor}40` }}
                onClick={() => { handleClose(); setPaymentOpen(true); }}
              >
                Quero adquirir
              </Button>
            </div>
          )}
          <style>{`@keyframes chatBubbleIn { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes dotBounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }`}</style>
        </DialogContent>
      </Dialog>
      <PaymentFlow open={paymentOpen} onOpenChange={setPaymentOpen} offer={offer} themeColor={themeColor} memberPhone={memberPhone || ""} workspaceId={workspaceId} />
    </>
  );
}
