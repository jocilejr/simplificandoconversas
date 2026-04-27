import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import MaterialCard from "./MaterialCard";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Props {
  productId: string;
  productName: string;
  themeColor: string;
  phone?: string;
  productDescription?: string | null;
  initialCategories?: any[];
  initialMaterials?: any[];
  grantedAt?: string;
  onActivityChange?: (activity: string, productName?: string, materialName?: string) => void;
}

export default function ProductContentViewer({
  productId,
  productName,
  themeColor,
  phone,
  productDescription,
  initialCategories,
  initialMaterials,
  grantedAt,
  onActivityChange,
}: Props) {
  const [preloadedPdf, setPreloadedPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const preloadedPdfIdRef = useRef<string | null>(null);
  const shouldLoadProductDetail = typeof productDescription === "undefined";
  const shouldLoadCategories = typeof initialCategories === "undefined";
  const shouldLoadMaterials = typeof initialMaterials === "undefined";

  const { data: productDetail } = useQuery({
    queryKey: ["product-member-detail", productId],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products").select("member_description").eq("id", productId).single();
      return data as any;
    },
    enabled: shouldLoadProductDetail,
  });

  const { data: categoriesData, isLoading: loadingCats } = useQuery({
    queryKey: ["member-categories", productId],
    queryFn: async () => {
      const { data } = await supabase.from("member_product_categories").select("*").eq("product_id", productId).order("sort_order");
      return data || [];
    },
    enabled: shouldLoadCategories,
  });

  const { data: materialsData, isLoading: loadingMats } = useQuery({
    queryKey: ["member-materials", productId],
    queryFn: async () => {
      const { data } = await supabase.from("member_product_materials").select("*").eq("product_id", productId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: shouldLoadMaterials,
  });

  const resolvedDescription = shouldLoadProductDetail ? productDetail?.member_description : productDescription;
  const allCategories = initialCategories ?? categoriesData ?? [];
  const allMaterials = initialMaterials ?? materialsData ?? [];
  const mostRecentPdf = [...allMaterials].reverse().find((m: any) => m.content_type === "pdf" && m.content_url);

  useEffect(() => {
    if (!mostRecentPdf?.content_url || preloadedPdfIdRef.current === mostRecentPdf.id) return;
    preloadedPdfIdRef.current = mostRecentPdf.id;
    pdfjsLib.getDocument({ url: mostRecentPdf.content_url, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise.then((doc) => setPreloadedPdf(doc)).catch(() => {});
  }, [mostRecentPdf?.id, mostRecentPdf?.content_url]);

  useEffect(() => { onActivityChange?.("viewing_product", productName); }, [productId]);

  if ((shouldLoadCategories && loadingCats) || (shouldLoadMaterials && loadingMats)) return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: themeColor }} /></div>;

  if (allMaterials.length === 0) return <div className="text-center py-10"><p className="text-sm text-gray-400">Conteúdo em breve...</p></div>;

  const categorized = allCategories.map((cat: any) => ({ ...cat, materials: allMaterials.filter((m: any) => m.category_id === cat.id) })).filter((cat: any) => cat.materials.length > 0);
  const uncategorized = allMaterials.filter((m: any) => !m.category_id);

  const renderMaterialCard = (mat: any) => {
    const activityType = mat.content_type === "pdf" ? "reading_pdf" : mat.content_type === "video" ? "watching_video" : "viewing_product";
    return <MaterialCard key={mat.id} material={mat} themeColor={themeColor} preloadedPdf={mostRecentPdf?.id === mat.id ? preloadedPdf : undefined} phone={phone} grantedAt={grantedAt} onOpen={() => onActivityChange?.(activityType, productName, mat.title)} />;
  };

  return (
    <div className="space-y-8">
      {resolvedDescription && <div className="space-y-3"><p className="text-sm text-gray-600 leading-relaxed px-1">{resolvedDescription}</p></div>}
      {categorized.map((cat: any) => (
        <div key={cat.id}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: `${themeColor}10` }}>{cat.icon || "📖"}</div>
            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{cat.name}</h4>
            <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
            <span className="text-xs text-gray-400 font-medium">{cat.materials.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{cat.materials.map(renderMaterialCard)}</div>
        </div>
      ))}
      {uncategorized.length > 0 && (
        <div>
          {categorized.length > 0 && <div className="flex items-center gap-3 mb-4"><div className="h-8 w-8 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: `${themeColor}10` }}>📂</div><h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Outros</h4><div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" /><span className="text-xs text-gray-400 font-medium">{uncategorized.length}</span></div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{uncategorized.map(renderMaterialCard)}</div>
        </div>
      )}
    </div>
  );
}
