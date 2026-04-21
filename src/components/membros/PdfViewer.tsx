import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

interface Props {
  url: string;
  themeColor: string;
  preloadedPdf?: pdfjsLib.PDFDocumentProxy | null;
  phone?: string;
  materialId?: string;
}

export default function PdfViewer({ url, themeColor, preloadedPdf, phone, materialId }: Props) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveProgress = useCallback((page: number, total: number) => {
    if (!phone || !materialId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await supabase.from("member_content_progress").upsert({
          normalized_phone: phone,
          material_id: materialId,
          progress_type: "pdf",
          current_page: page,
          total_pages: total,
          last_accessed_at: new Date().toISOString(),
        } as any, { onConflict: "normalized_phone,material_id" });
      } catch {}
    }, 1500);
  }, [phone, materialId]);

  useEffect(() => {
    if (preloadedPdf) {
      setPdf(preloadedPdf);
      setTotalPages(preloadedPdf.numPages);
      setCurrentPage(1);
      setLoading(false);
      return;
    }

    if (!url) {
      setError("URL do PDF não configurada.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    pdfjsLib
      .getDocument({ url, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true })
      .promise.then((doc) => {
        if (cancelled) return;
        setPdf(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      })
      .catch((err) => {
        console.error("[PdfViewer] load error:", err?.message || err);
        if (!cancelled) setError("Não foi possível carregar o PDF.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url, preloadedPdf]);

  useEffect(() => {
    if (currentPage && totalPages) saveProgress(currentPage, totalPages);
  }, [currentPage, totalPages, saveProgress]);

  const renderPage = useCallback(async (pageNum: number, zoomMultiplier: number) => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;

    const page = await pdf.getPage(pageNum);
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32;

    if (containerWidth <= 0) {
      requestAnimationFrame(() => renderPage(pageNum, zoomMultiplier));
      return;
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = containerWidth / baseViewport.width;
    const userScale = fitScale * zoomMultiplier;
    const dpr = window.devicePixelRatio || 1;
    const renderScale = userScale * dpr;
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const cssWidth = baseViewport.width * userScale;
    const cssHeight = baseViewport.height * userScale;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }, [pdf]);

  useEffect(() => {
    if (pdf && currentPage) renderPage(currentPage, zoom);
  }, [pdf, currentPage, zoom, renderPage]);

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchRef.current = { startDist: getTouchDistance(e.touches[0], e.touches[1]), startZoom: zoom };
    }
  }, [zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = dist / pinchRef.current.startDist;
      setZoom(Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.startZoom * scale)) * 100) / 100);
    }
  }, []);

  const handleTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + (e.deltaY > 0 ? -0.1 : 0.1))) * 100) / 100);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: themeColor }} />
        <p className="text-lg font-medium">Carregando PDF...</p>
      </div>
    );
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-500 text-lg font-medium p-8 text-center">{error}</div>;
  }

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-center gap-2 sm:gap-4 py-2 px-3 border-b border-gray-200 bg-gray-50/50 shrink-0 flex-wrap">
        {totalPages > 1 && (
          <>
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="h-10 px-3 text-sm font-semibold gap-1.5">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-sm font-bold min-w-[80px] text-center" style={{ color: themeColor }}>{currentPage} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="h-10 px-3 text-sm font-semibold gap-1.5">
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
        {totalPages > 1 && <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100))} className="h-10 w-10 p-0" title="Diminuir zoom"><ZoomOut className="h-4 w-4" /></Button>
          <button onClick={() => setZoom(1)} className="text-xs font-bold min-w-[50px] text-center rounded-md px-2 py-1.5 hover:bg-gray-100 transition-colors" style={{ color: themeColor }}>{zoomPercent}%</button>
          <Button variant="outline" size="sm" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))} className="h-10 w-10 p-0" title="Aumentar zoom"><ZoomIn className="h-4 w-4" /></Button>
          {zoom !== 1 && <Button variant="ghost" size="sm" onClick={() => setZoom(1)} className="h-10 w-10 p-0" title="Restaurar"><RotateCcw className="h-4 w-4" /></Button>}
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center items-start p-4 bg-gray-50/30 touch-none" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onWheel={handleWheel}>
        <canvas ref={canvasRef} className="shadow-lg rounded-lg" />
      </div>
    </div>
  );
}
