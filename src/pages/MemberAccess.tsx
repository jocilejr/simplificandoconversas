import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { firePixels, type PixelInfo } from "@/lib/pixelFiring";
import { apiUrl, safeJsonResponse } from "@/lib/api";
import { Loader2, Crown, ShoppingBag, Check, Lock, BookOpen, Play } from "lucide-react";
import DailyVerse from "@/components/membros/DailyVerse";
import ProductContentViewer from "@/components/membros/ProductContentViewer";
import LockedOfferCard from "@/components/membros/LockedOfferCard";
import BottomPageOffer from "@/components/membros/BottomPageOffer";
import PhysicalProductShowcase from "@/components/membros/PhysicalProductShowcase";
import FloatingOfferBar from "@/components/membros/FloatingOfferBar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import meirePhoto from "@/assets/meire-rosana.png";
import { useMemberSession } from "@/hooks/useMemberSession";

interface MemberProduct {
  id: string;
  product_id: string;
  is_active: boolean;
  granted_at: string;
  delivery_products: {
    name: string;
    slug: string;
    redirect_url: string | null;
    page_logo: string | null;
    value: number | null;
    member_cover_image: string | null;
  } | null;
}

interface MemberSettings {
  title: string;
  logo_url: string | null;
  welcome_message: string | null;
  theme_color: string;
  ai_persona_prompt?: string | null;
  greeting_prompt?: string | null;
  offer_prompt?: string | null;
}

interface AiContext {
  greeting: string;
  tip: string;
}

interface MemberProfile {
  memberSince: string | null;
  totalPaid: number;
  totalTransactions: number;
  totalProducts: number;
  daysSinceLastAccess: number | null;
}

interface ContentProgress {
  material_id: string;
  progress_type: string;
  current_page: number;
  total_pages: number;
  video_seconds: number;
  video_duration: number;
  last_accessed_at: string;
}

interface ProductProgress {
  materialsAccessed: number;
  totalMaterials: number;
  latestProgress: ContentProgress | null;
}

// Backend response shape (from VPS member-access endpoint)
interface BackendProduct {
  id: string;
  name: string;
  slug: string;
  member_cover_image: string | null;
  member_description: string | null;
  page_logo: string | null;
  value?: number | null;
  categories: any[];
  materials: any[];
}

interface BackendResponse {
  phone: string;
  workspace_id?: string;
  settings: MemberSettings | null;
  products: BackendProduct[];
  offers?: any[];
  customer?: { name: string | null; document?: string | null; first_seen_at?: string; total_paid?: number; total_transactions?: number } | null;
}

const AI_CACHE_KEY = "member_ai_context";
const AI_CACHE_TTL = 4 * 60 * 60 * 1000;

export default function MemberAccess() {
  const { phone } = useParams<{ phone: string }>();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MemberProduct[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [settings, setSettings] = useState<MemberSettings | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerDocument, setCustomerDocument] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [aiContext, setAiContext] = useState<AiContext | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, ContentProgress[]>>({});
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [materialsByProduct, setMaterialsByProduct] = useState<Record<string, any[]>>({});
  const [globalImpressions, setGlobalImpressions] = useState<Record<string, number>>({});
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [offerMetricsReady, setOfferMetricsReady] = useState(false);
  const impressionsRegisteredRef = useRef(false);
  const pixelFramesFiredRef = useRef(false);

  const normalizedPhone = useMemo(() => phone?.replace(/\D/g, "") || "", [phone]);

  // Session tracking
  const sessionActive = !loading && !notFound && !!normalizedPhone;
  const { updateActivity } = useMemberSession(normalizedPhone, sessionActive);

  const handleActivityChange = useCallback((activity: string, productName?: string, materialName?: string) => {
    updateActivity({
      current_activity: activity,
      current_product_name: productName || null,
      current_material_name: materialName || null,
    });
  }, [updateActivity]);

  useEffect(() => {
    if (!phone) return;
    loadMemberData();
  }, [phone]);

  const loadMemberData = async () => {
    if (!phone) return;
    setLoading(true);
    setAiLoading(true);
    setOfferMetricsReady(false);
    impressionsRegisteredRef.current = false;
    const digits = phone.replace(/\D/g, "");

    try {
      // Fetch initial data from VPS backend
      const response = await fetch(`/api/member-access/${digits}`);
      if (!response.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const payload = await response.json() as BackendResponse;
      const wsId = payload.workspace_id || null;
      setWorkspaceId(wsId);

      if (!response.ok || !payload.products?.length) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Convert backend products to MemberProduct format
      const memberProds: MemberProduct[] = payload.products.map((p, idx) => ({
        id: `mp-${p.id}-${idx}`,
        product_id: p.id,
        is_active: true,
        granted_at: new Date().toISOString(), // Backend doesn't return this yet
        delivery_products: {
          name: p.name,
          slug: p.slug,
          redirect_url: null,
          page_logo: p.page_logo,
          value: p.value || null,
          member_cover_image: p.member_cover_image,
        },
      }));

      const memberOffers = payload.offers || [];
      setProducts(memberProds);
      setOffers(memberOffers);
      setSettings(
        payload.settings
          ? { ...payload.settings, theme_color: (payload.settings as any).theme_color || "#8B5CF6" }
          : { title: "Área de Membros", logo_url: null, welcome_message: "Bem-vinda à sua área exclusiva! 🎉", theme_color: "#8B5CF6" }
      );

      const name = payload.customer?.name || null;
      setCustomerName(name);
      setCustomerDocument(payload.customer?.document || null);

      // Load materials map from the backend response (already included)
      const matsByProd: Record<string, any[]> = {};
      payload.products.forEach(p => {
        matsByProd[p.id] = p.materials || [];
      });
      setMaterialsByProduct(matsByProd);

      // Load progress from Supabase directly (public RLS)
      const variations = generatePhoneVariations(digits);
      const { data: progressData } = await supabase
        .from("member_content_progress")
        .select("*")
        .in("normalized_phone", variations);

      const progByProd: Record<string, ContentProgress[]> = {};
      const allProgress = (progressData || []) as unknown as ContentProgress[];
      allProgress.forEach(p => {
        for (const [prodId, mats] of Object.entries(matsByProd)) {
          if (mats.some((m: any) => m.id === p.material_id)) {
            if (!progByProd[prodId]) progByProd[prodId] = [];
            progByProd[prodId].push(p);
            break;
          }
        }
      });
      setProgressMap(progByProd);

      // Load global offer impressions
      const { data: globalImpData } = await supabase
        .from("member_area_offers")
        .select("id, total_impressions")
        .eq("is_active", true);
      const gMap: Record<string, number> = {};
      (globalImpData || []).forEach((o: any) => { gMap[o.id] = o.total_impressions || 0; });
      setGlobalImpressions(gMap);
      setOfferMetricsReady(true);

      // Build member profile
      const memberSince = payload.customer?.first_seen_at || null;
      const totalPaid = payload.customer?.total_paid || 0;
      const totalTransactions = payload.customer?.total_transactions || 0;
      let daysSinceLastAccess: number | null = null;
      if (allProgress.length > 0) {
        const latestAccess = allProgress.reduce((latest, p) => {
          const d = new Date(p.last_accessed_at).getTime();
          return d > latest ? d : latest;
        }, 0);
        if (latestAccess > 0) daysSinceLastAccess = Math.floor((Date.now() - latestAccess) / (1000 * 60 * 60 * 24));
      }
      const profileData: MemberProfile = { memberSince, totalPaid: Number(totalPaid), totalTransactions: Number(totalTransactions), totalProducts: memberProds.length, daysSinceLastAccess };
      setMemberProfile(profileData);

      setLoading(false);
      loadAiContext(name, memberProds, memberOffers, matsByProd, allProgress, profileData, wsId);
    } catch (err) {
      console.error("[MemberAccess] Error loading data:", err);
      setNotFound(true);
      setLoading(false);
    }
  };

  const getProductProgress = (productId: string): ProductProgress => {
    const mats = materialsByProduct[productId] || [];
    const progs = progressMap[productId] || [];
    const latestProgress = progs.length > 0
      ? progs.sort((a, b) => new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime())[0]
      : null;
    return { materialsAccessed: progs.length, totalMaterials: mats.length, latestProgress };
  };

  const getProgressLabel = (progress: ContentProgress | null, productId: string): string | null => {
    if (!progress) return null;
    const mats = materialsByProduct[productId] || [];
    const mat = mats.find((m: any) => m.id === progress.material_id);
    const matName = mat?.title || "material";
    if (progress.progress_type === "pdf" && progress.total_pages > 0) return `📖 Parou na pág. ${progress.current_page} de ${progress.total_pages} — "${matName}"`;
    if (progress.progress_type === "video" && progress.video_duration > 0) { const pct = Math.round((progress.video_seconds / progress.video_duration) * 100); return `▶️ Assistiu ${pct}% — "${matName}"`; }
    return `Último acesso: "${matName}"`;
  };

  const loadAiContext = async (name: string | null, prods: MemberProduct[], memberOffers: any[], matsByProd: Record<string, any[]>, progressData: ContentProgress[], profileData: MemberProfile, wsId: string | null) => {
    const cacheKey = `${AI_CACHE_KEY}_${phone}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < AI_CACHE_TTL) {
          setAiContext(parsed.data);
          setAiLoading(false);
          setIsTyping(true);
          setTimeout(() => {
            setIsTyping(false);
            setVisibleMessages(1);
            let idx = 0;
            const fullText = parsed.data.greeting;
            setTypedText("");
            if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = setInterval(() => {
              idx++;
              if (idx >= fullText.length) {
                setTypedText(fullText);
                if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
              } else {
                setTypedText(fullText.slice(0, idx));
              }
            }, 20);
          }, 3000);
          return;
        }
      }
    } catch {}

    try {
      const firstName = name?.split(" ")[0] || "Querido(a)";
      const productsPayload = prods.filter(p => p.delivery_products).map(p => ({
        name: p.delivery_products!.name,
        materials: (matsByProd[p.product_id] || []).map((m: any) => m.title),
      }));
      const ownedProductNamesPayload = prods.filter(p => p.delivery_products).map(p => p.delivery_products!.name);
      const progressPayload = progressData.map(p => {
        let matName = "material";
        for (const mats of Object.values(matsByProd)) {
          const found = mats.find((m: any) => m.id === p.material_id);
          if (found) { matName = found.title; break; }
        }
        return { materialName: matName, type: p.progress_type, currentPage: p.current_page, totalPages: p.total_pages, videoSeconds: p.video_seconds, videoDuration: p.video_duration };
      });

      const aiRes = await fetch("/api/member-access/ai-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, products: productsPayload, ownedProductNames: ownedProductNamesPayload, progress: progressPayload, profile: profileData, workspaceId: wsId, phone: phone?.replace(/\D/g, "") }),
      });
      const data = aiRes.ok ? await aiRes.json() : null;
      const error = aiRes.ok ? null : "AI request failed";

      if (!error && data?.greeting) {
        const ctx: AiContext = { greeting: data.greeting, tip: data.tip || "" };
        setAiContext(ctx);
        setVisibleMessages(0);
        // Show typing indicator for 3 seconds, then start typewriter
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setVisibleMessages(1);
          // Start typewriter effect
          let idx = 0;
          const fullText = ctx.greeting;
          setTypedText("");
          if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = setInterval(() => {
            idx++;
            if (idx >= fullText.length) {
              setTypedText(fullText);
              if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
            } else {
              setTypedText(fullText.slice(0, idx));
            }
          }, 20);
        }, 3000);
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: ctx, cachedAt: Date.now() })); } catch {}
      }
    } catch {}
    setAiLoading(false);
  };

  // Filter out offers for products the member already owns
  const filteredOffers = useMemo(() => {
    const ownedProdIds = new Set(products.map(p => p.product_id));
    const ownedProdNames = new Set(products.filter(p => p.delivery_products?.name).map(p => p.delivery_products!.name.toLowerCase().trim()));
    return offers.filter((offer: any) => {
      if (offer.product_id && ownedProdIds.has(offer.product_id)) return false;
      if (offer.name && ownedProdNames.has(offer.name.toLowerCase().trim())) return false;
      return true;
    });
  }, [offers, products]);

  // Strategic rotation: pick 1 card offer — prioritize fewest global impressions
  const cardOffers = useMemo(() => {
    if (!offerMetricsReady) return [];
    const allCards = filteredOffers.filter((o: any) => o.display_type !== "bottom_page" && o.display_type !== "showcase");
    if (allCards.length <= 1) return allCards;
    const sorted = [...allCards].sort((a: any, b: any) => (globalImpressions[a.id] || 0) - (globalImpressions[b.id] || 0));
    return [sorted[0]];
  }, [filteredOffers, globalImpressions, offerMetricsReady]);

  const bottomPageOffers = useMemo(() => filteredOffers.filter((o: any) => o.display_type === "bottom_page"), [filteredOffers]);
  const showcaseOffers = useMemo(() => filteredOffers.filter((o: any) => o.display_type === "showcase"), [filteredOffers]);

  const shownOfferIds = useMemo(() => [...cardOffers.map((o: any) => o.id), ...showcaseOffers.map((o: any) => o.id)], [cardOffers, showcaseOffers]);

  useEffect(() => {
    if (!offerMetricsReady || !normalizedPhone || shownOfferIds.length === 0 || impressionsRegisteredRef.current) return;
    impressionsRegisteredRef.current = true;
    shownOfferIds.forEach((offerId: string) => { supabase.rpc("increment_offer_impression", { offer_id: offerId }).then(() => {}); });
    const upserts = shownOfferIds.map((offerId: string) => ({ normalized_phone: normalizedPhone, offer_id: offerId, impression_count: 1, clicked: false, last_shown_at: new Date().toISOString() }));
    supabase.from("member_offer_impressions").upsert(upserts as any, { onConflict: "normalized_phone,offer_id" }).then(() => {});
  }, [offerMetricsReady, normalizedPhone, shownOfferIds.join(",")]);

  // Fire pending pixel frames
  useEffect(() => {
    if (!normalizedPhone || loading || notFound || pixelFramesFiredRef.current) return;
    pixelFramesFiredRef.current = true;
    const firePendingPixelFrames = async () => {
      const variations = generatePhoneVariations(normalizedPhone);
      if (variations.length === 0) return;
      const [framesRes, pixelsRes, customerRes] = await Promise.all([
        supabase.from("member_pixel_frames").select("id, product_name, product_value").in("normalized_phone", variations).eq("fired", false),
        supabase.from("global_delivery_pixels").select("platform, pixel_id, event_name, access_token").eq("is_active", true),
        supabase.from("customers" as any).select("name, email").in("normalized_phone", variations).limit(1).maybeSingle(),
      ]);
      const frames = framesRes.data || [];
      const globalPixels = (pixelsRes.data || []) as PixelInfo[];
      if (frames.length === 0 || globalPixels.length === 0) return;
      const customer = customerRes.data as any;
      const nameParts = customer?.name?.trim().split(/\s+/) || [];
      const userData = { email: customer?.email || null, firstName: nameParts[0] || null, lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : null };
      for (const frame of frames) { firePixels(globalPixels, Number((frame as any).product_value) || 0, normalizedPhone, userData); }
      const frameIds = frames.map((f: any) => f.id);
      await supabase.from("member_pixel_frames").update({ fired: true, fired_at: new Date().toISOString() } as any).in("id", frameIds);
    };
    firePendingPixelFrames();
  }, [normalizedPhone, loading, notFound]);

  const sortedProducts = useMemo(() => [...products].sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime()), [products]);
  const ownedProductNames = useMemo(() => products.filter(p => p.delivery_products).map(p => p.delivery_products!.name), [products]);
  const ownedProductIds = useMemo(() => products.map(p => p.product_id), [products]);
  const firstName = customerName?.split(" ")[0] || "Querido(a)";

  const openProduct = useMemo(() => {
    if (!openProductId) return null;
    return sortedProducts.find(p => p.id === openProductId) || null;
  }, [openProductId, sortedProducts]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Crown className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Área não encontrada</h1>
          <p className="text-gray-500 text-sm leading-relaxed">Não encontramos produtos liberados para este número.</p>
        </div>
      </div>
    );
  }

  const themeColor = settings?.theme_color || "#8B5CF6";
  const greetingText = aiContext?.greeting || settings?.welcome_message || "Sua área exclusiva";

  const isRecent = (grantedAt: string) => {
    const diffDays = (Date.now() - new Date(grantedAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 3;
  };

  const renderProductCard = (mp: MemberProduct) => {
    const product = mp.delivery_products;
    if (!product) return null;
    const recent = isRecent(mp.granted_at);
    const progress = getProductProgress(mp.product_id);
    const mats = materialsByProduct[mp.product_id] || [];
    const progressLabel = getProgressLabel(progress.latestProgress, mp.product_id);
    const progressPct = progress.totalMaterials > 0 ? Math.round((progress.materialsAccessed / progress.totalMaterials) * 100) : 0;
    const coverSrc = product.member_cover_image || product.page_logo;

    return (
      <button
        key={mp.id}
        className="w-full rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 text-left active:scale-[0.98] group relative bg-white border border-gray-100"
        onClick={() => setOpenProductId(mp.id)}
      >
        {coverSrc ? (
          <div className="relative h-[120px] w-full overflow-hidden">
            <img src={coverSrc} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white mb-2 bg-emerald-500/90">
                <Check className="h-3 w-3" strokeWidth={3} />{recent ? "Novo" : "Liberado"}
              </span>
              <h3 className="font-bold text-white text-lg leading-tight line-clamp-2" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>{product.name}</h3>
            </div>
          </div>
        ) : (
          <div className="relative h-[100px] w-full flex flex-col justify-end p-4" style={{ background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 50%, ${themeColor}12 100%)` }}>
            {mats.length > 0 && mats[0]?.content_type === "video" ? (
              <Play className="absolute top-3 right-3 h-8 w-8 opacity-[0.08]" style={{ color: themeColor }} />
            ) : mats.length > 0 && mats[0]?.content_type === "pdf" ? (
              <BookOpen className="absolute top-3 right-3 h-8 w-8 opacity-[0.08]" style={{ color: themeColor }} />
            ) : (
              <ShoppingBag className="absolute top-3 right-3 h-8 w-8 opacity-[0.08]" style={{ color: themeColor }} />
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white w-fit mb-2 bg-emerald-500/90">
              <Check className="h-3 w-3" strokeWidth={3} />{recent ? "Novo" : "Liberado"}
            </span>
            <h3 className="font-bold text-gray-800 text-lg leading-tight line-clamp-2">{product.name}</h3>
          </div>
        )}
        {progress.totalMaterials > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-50">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, backgroundColor: themeColor }} />
                </div>
                <span className="text-[10px] font-medium text-gray-400 shrink-0">{progress.materialsAccessed}/{progress.totalMaterials}</span>
              </div>
              {progressLabel && <p className="text-xs text-gray-500 leading-tight truncate">{progressLabel}</p>}
            </div>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-5 pt-5 pb-20 space-y-4">
        {/* AI Greeting */}
        <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-50">
            <div className="relative">
              <img src={meirePhoto} alt="Meire Rosana" className="h-8 w-8 rounded-full object-cover" style={{ border: `2px solid ${themeColor}30` }} />
              <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800">Meire Rosana</p>
              {(aiLoading || isTyping) && <p className="text-[10px] font-medium" style={{ color: themeColor }}>digitando...</p>}
            </div>
          </div>
          <div className="px-3 pb-3 pt-2.5 space-y-1.5">
            {(aiLoading || isTyping) && visibleMessages === 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-tl-md w-fit bg-gray-100">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            ) : (
              <>
                {visibleMessages >= 1 && (
                  <div className="px-3 py-2 rounded-2xl rounded-tl-md text-xs text-gray-700 leading-relaxed w-fit max-w-[90%] animate-fade-in bg-gray-100">
                    {typedText || `Olá${firstName ? `, ${firstName}` : ''}! ${settings?.welcome_message || 'Bem-vindo(a) à sua área exclusiva!'}`}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Interleaved products and offers */}
        {(() => {
          const interleaved: ({ type: "product"; data: MemberProduct } | { type: "offer"; data: any })[] = [];
          let offerIdx = 0;
          for (let i = 0; i < sortedProducts.length; i++) {
            interleaved.push({ type: "product", data: sortedProducts[i] });
            if ((i + 1) % 2 === 0 && offerIdx < cardOffers.length) {
              interleaved.push({ type: "offer", data: cardOffers[offerIdx++] });
            }
          }
          while (offerIdx < cardOffers.length) {
            interleaved.push({ type: "offer", data: cardOffers[offerIdx++] });
          }

          return interleaved.map((item) => {
            if (item.type === "product") return renderProductCard(item.data);
            return (
              <LockedOfferCard
                key={item.data.id}
                offer={item.data}
                themeColor={themeColor}
                ownedProductNames={ownedProductNames}
                ownedProductIds={ownedProductIds}
                firstName={firstName}
                memberProfile={memberProfile}
                memberPhone={normalizedPhone}
                workspaceId={workspaceId}
                customerName={customerName || undefined}
                customerDocument={customerDocument || undefined}
              />
            );
          });
        })()}

        <DailyVerse />

        {showcaseOffers.length > 0 && (
          <div className="space-y-3">
            {showcaseOffers.map((offer: any) => (
              <PhysicalProductShowcase key={offer.id} offer={offer} themeColor={themeColor} memberPhone={normalizedPhone} workspaceId={workspaceId} customerName={customerName || undefined} customerDocument={customerDocument || undefined} />
            ))}
          </div>
        )}

        {bottomPageOffers.length > 0 && (
          <div className="space-y-4 pt-4">
            {bottomPageOffers.map((offer: any) => (
              <BottomPageOffer key={offer.id} offer={offer} themeColor={themeColor} />
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!openProductId} onOpenChange={(open) => {
        if (!open) { setOpenProductId(null); handleActivityChange("viewing_home"); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-white">
          {openProduct?.delivery_products && (
            <>
              <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3">
                {openProduct.delivery_products.page_logo && <img src={openProduct.delivery_products.page_logo} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                <h2 className="font-bold text-gray-800 text-lg truncate">{openProduct.delivery_products.name}</h2>
              </div>
              <div className="p-5">
                <ProductContentViewer
                  productId={openProduct.product_id}
                  productName={openProduct.delivery_products.name}
                  themeColor={themeColor}
                  phone={normalizedPhone}
                  onActivityChange={handleActivityChange}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <footer className="text-center py-5 border-t border-gray-100 bg-white">
        <p className="text-[10px] text-gray-300 tracking-wide">Área exclusiva para membros</p>
      </footer>
    </div>
  );
}
