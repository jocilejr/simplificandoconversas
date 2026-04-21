import { useState, useRef, useCallback, lazy, Suspense } from "react";
import { FileText, Video, Image, Download, ExternalLink, ArrowLeft, Loader2, Music } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type * as pdfjsLib from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";
import PdfViewer from "./PdfViewer";
import { Button } from "@/components/ui/button";

interface Material {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
  button_label?: string | null;
}

interface Props {
  material: Material;
  themeColor: string;
  preloadedPdf?: pdfjsLib.PDFDocumentProxy | null;
  phone?: string;
  onOpen?: () => void;
}

const typeConfig: Record<string, { icon: typeof FileText; label: string; accent: string }> = {
  text: { icon: FileText, label: "Texto", accent: "#6366f1" },
  pdf: { icon: Download, label: "PDF", accent: "#ef4444" },
  video: { icon: Video, label: "Vídeo", accent: "#8b5cf6" },
  image: { icon: Image, label: "Imagem", accent: "#10b981" },
  audio: { icon: Music, label: "Áudio", accent: "#f59e0b" },
};

export default function MaterialCard({ material, themeColor, preloadedPdf, phone, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const config = typeConfig[material.content_type] || typeConfig.text;
  const Icon = config.icon;
  const videoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasContent = material.content_type !== "pdf" || !!material.content_url;

  const handleOpen = () => {
    if (!hasContent) return;
    onOpen?.();
    if (material.content_type === "pdf") setPdfOpen(true);
    else setOpen(true);
  };

  const saveVideoProgress = useCallback((seconds: number, duration: number) => {
    if (!phone || !material.id) return;
    if (videoSaveTimer.current) clearTimeout(videoSaveTimer.current);
    videoSaveTimer.current = setTimeout(async () => {
      try {
        await supabase.from("member_content_progress").upsert({
          normalized_phone: phone,
          material_id: material.id,
          progress_type: "video",
          video_seconds: Math.floor(seconds),
          video_duration: Math.floor(duration),
          last_accessed_at: new Date().toISOString(),
        } as any, { onConflict: "normalized_phone,material_id" });
      } catch {}
    }, 3000);
  }, [phone, material.id]);

  const handleVideoTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    saveVideoProgress(video.currentTime, video.duration || 0);
  }, [saveVideoProgress]);

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={!hasContent}
        className={"group relative w-full text-left rounded-xl border shadow-sm overflow-hidden transition-all duration-300 " + (hasContent ? "bg-white border-gray-200 hover:shadow-lg hover:-translate-y-0.5" : "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed")}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl transition-all duration-300 group-hover:w-2" style={{ backgroundColor: config.accent }} />
        <div className="pl-6 pr-5 py-5 flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${config.accent}10` }}>
            <Icon className="h-6 w-6" style={{ color: config.accent }} />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="font-bold text-base text-gray-800 leading-snug line-clamp-2 group-hover:text-gray-600 transition-colors uppercase tracking-wide">{material.title}</p>
            {material.description && <p className="text-sm text-gray-500 line-clamp-2">{material.description}</p>}
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ backgroundColor: `${config.accent}12`, color: config.accent }}>{config.label}</span>
          </div>
        </div>
      </button>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="w-[98vw] max-w-[98vw] h-[95vh] max-h-[95vh] flex flex-col p-0 overflow-hidden gap-0 bg-white [&>button:last-child]:hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-4 shrink-0 bg-white">
            <Button variant="ghost" size="lg" onClick={() => setPdfOpen(false)} className="text-lg gap-2 px-5 py-3 h-auto font-semibold text-gray-800 hover:bg-gray-100">
              <ArrowLeft className="h-6 w-6" />Voltar
            </Button>
            <h2 className="text-lg font-bold truncate text-gray-800">{material.title}</h2>
          </div>
          <PdfViewer url={material.content_url || ""} themeColor={themeColor} preloadedPdf={preloadedPdf || undefined} phone={phone} materialId={material.id} />
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 bg-white">
          <div className="px-6 pt-6 pb-4 border-b border-gray-200" style={{ background: `linear-gradient(135deg, ${config.accent}08, ${config.accent}04)` }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-lg text-gray-800">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.accent}15` }}>
                  <Icon className="h-4 w-4" style={{ color: config.accent }} />
                </div>
                {material.title}
              </DialogTitle>
              {material.description && <p className="text-sm text-gray-500 mt-1 pl-12">{material.description}</p>}
            </DialogHeader>
          </div>
          <div className="p-6">
            {material.content_type === "text" && (
              <div className="space-y-5">
                {material.content_text && (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-gray-700 rounded-xl p-6 border border-gray-200 bg-gray-50 break-words overflow-hidden"
                    dangerouslySetInnerHTML={{
                      __html: material.content_text
                        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all hover:text-blue-800">$1</a>')
                    }}
                  />
                )}
                {material.content_url && (
                  <Button className="w-full gap-2 text-white" style={{ backgroundColor: themeColor }} onClick={() => window.open(material.content_url!, "_blank")}>
                    <ExternalLink className="h-4 w-4" />{material.button_label || "Acessar"}
                  </Button>
                )}
              </div>
            )}
            {material.content_type === "image" && material.content_url && (
              <img src={material.content_url} alt={material.title} className="w-full rounded-xl shadow-sm" />
            )}
            {material.content_type === "video" && material.content_url && (
              <div className="aspect-video rounded-xl overflow-hidden shadow-sm">
                {material.content_url.includes("youtube") || material.content_url.includes("youtu.be") ? (
                  <iframe src={material.content_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                ) : (
                  <video src={material.content_url} controls className="w-full h-full" onTimeUpdate={handleVideoTimeUpdate} />
                )}
              </div>
            )}
            {material.content_type === "audio" && material.content_url && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${config.accent}15` }}>
                    <Music className="h-6 w-6" style={{ color: config.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{material.title}</p>
                    {material.description && <p className="text-xs text-gray-500 truncate">{material.description}</p>}
                  </div>
                </div>
                <audio src={material.content_url} controls className="w-full" controlsList="nodownload" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
