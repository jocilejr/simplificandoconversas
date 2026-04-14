import { useState, useEffect, useRef } from "react";
import {
  MessageSquare, Image, Video, Mic, FileText, Sticker, MapPin,
  Contact, BarChart3, List, CheckCheck, Sparkles,
  Play, FileIcon, User, Phone, VideoIcon, MoreVertical, Search
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LinkPreviewData {
  title?: string;
  description?: string;
  image?: string;
  logo?: string;
  url?: string;
}

interface Props {
  messageType: string;
  content: any;
  mentionAll?: boolean;
  forceLinkPreview?: boolean;
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

function formatWhatsAppText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    .replace(/```([^`]+)```/g, '<code class="bg-black/30 px-0.5 rounded text-[10px] font-mono">$1</code>')
    .replace(/\n/g, '<br/>');
}

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

export default function WhatsAppPreview({ messageType, content, mentionAll, forceLinkPreview }: Props) {
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const text = content?.text || "";
  const url = extractUrl(text);

  useEffect(() => {
    if (messageType !== "text" || !url || !forceLinkPreview) {
      setLinkPreview(null);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoadingPreview(true);
      fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, { signal: controller.signal })
        .then(r => r.json())
        .then(data => {
          if (data.status === "success" && data.data) {
            setLinkPreview({
              title: data.data.title,
              description: data.data.description,
              image: data.data.image?.url,
              logo: data.data.logo?.url,
              url: data.data.url,
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPreview(false));
    }, 600);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [url, forceLinkPreview, messageType]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, messageType, mentionAll, linkPreview]);

  const hasContent = () => {
    switch (messageType) {
      case "text": return !!text;
      case "image": case "video": case "audio": case "document": case "sticker":
        return !!content?.mediaUrl;
      case "contact": return !!content?.contactName;
      case "location": return !!content?.latitude;
      case "poll": return !!content?.question;
      case "list": return !!content?.title;
      default: return false;
    }
  };

  const renderBubbleContent = () => {
    switch (messageType) {
      case "text":
        return (
          <div className="space-y-0">
            {linkPreview && (
              <div className="rounded overflow-hidden mb-1 border border-white/5">
                {linkPreview.image && (
                  <div className="w-full h-[100px] bg-black/20 overflow-hidden">
                    <img src={linkPreview.image} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-1.5 bg-[#1d2a21]">
                  <p className="text-[9px] text-[#8696a0] uppercase tracking-wide">{getDomain(url!)}</p>
                  <p className="text-[10px] text-[#e9edef] font-medium leading-tight mt-0.5 line-clamp-2">{linkPreview.title}</p>
                  {linkPreview.description && (
                    <p className="text-[9px] text-[#8696a0] leading-tight mt-0.5 line-clamp-2">{linkPreview.description}</p>
                  )}
                </div>
              </div>
            )}
            {loadingPreview && (
              <div className="rounded p-2 mb-1 bg-[#1d2a21] animate-pulse">
                <div className="h-1.5 bg-white/10 rounded w-16 mb-1" />
                <div className="h-2 bg-white/10 rounded w-full mb-0.5" />
                <div className="h-1.5 bg-white/10 rounded w-3/4" />
              </div>
            )}
            {mentionAll && <span className="text-[#53bdeb] text-[11px]">@todos </span>}
            <span className="text-[11px] text-[#e9edef] leading-[16px] break-words" dangerouslySetInnerHTML={{ __html: formatWhatsAppText(text) }} />
          </div>
        );

      case "image":
        return (
          <div className="space-y-0.5">
            <div className="w-full h-[120px] bg-[#1d2a21] rounded overflow-hidden flex items-center justify-center">
              {content?.mediaUrl ? (
                <img src={content.mediaUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <Image className="h-5 w-5 text-[#8696a0]" />
              )}
            </div>
            {mentionAll && <span className="text-[#53bdeb] text-[11px]">@todos </span>}
            {content?.caption && <p className="text-[11px] text-[#e9edef]">{content.caption}</p>}
          </div>
        );

      case "video":
        return (
          <div className="space-y-0.5">
            <div className="w-full h-[120px] bg-[#1d2a21] rounded flex items-center justify-center relative">
              <div className="h-8 w-8 rounded-full bg-black/60 flex items-center justify-center">
                <Play className="h-3.5 w-3.5 text-white ml-0.5" />
              </div>
            </div>
            {mentionAll && <span className="text-[#53bdeb] text-[11px]">@todos </span>}
            {content?.caption && <p className="text-[11px] text-[#e9edef]">{content.caption}</p>}
          </div>
        );

      case "audio":
        return (
          <div className="flex items-center gap-1.5 min-w-[180px]">
            <div className="h-8 w-8 rounded-full bg-[#00a884]/20 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-[#00a884]" />
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center gap-1">
                <Play className="h-3 w-3 text-[#8696a0]" />
                <div className="flex-1 h-[4px] bg-[#374045] rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-[#8696a0] rounded-full" />
                </div>
              </div>
              <p className="text-[8px] text-[#8696a0]">0:00</p>
            </div>
          </div>
        );

      case "document":
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 p-2 bg-[#1d2a21] rounded">
              <div className="h-7 w-7 rounded bg-[#00a884]/15 flex items-center justify-center shrink-0">
                <FileIcon className="h-3.5 w-3.5 text-[#00a884]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#e9edef] truncate">{content?.mediaUrl?.split("/").pop() || "documento.pdf"}</p>
                <p className="text-[8px] text-[#8696a0]">PDF</p>
              </div>
            </div>
            {content?.caption && <p className="text-[11px] text-[#e9edef]">{content.caption}</p>}
          </div>
        );

      case "sticker":
        return (
          <div className="w-[90px] h-[90px] flex items-center justify-center">
            {content?.mediaUrl ? (
              <img src={content.mediaUrl} alt="sticker" className="max-w-full max-h-full" />
            ) : (
              <Sticker className="h-12 w-12 text-[#8696a0]/30" />
            )}
          </div>
        );

      case "location":
        return (
          <div className="space-y-0.5">
            <div className="w-full h-[90px] bg-[#1d2a21] rounded flex items-center justify-center">
              <MapPin className="h-6 w-6 text-[#00a884]" />
            </div>
            {content?.name && <p className="text-[11px] text-[#e9edef] font-medium">{content.name}</p>}
            {content?.address && <p className="text-[9px] text-[#8696a0]">{content.address}</p>}
          </div>
        );

      case "contact":
        return (
          <div className="min-w-[160px]">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/10">
              <div className="h-7 w-7 rounded-full bg-[#374045] flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-[#8696a0]" />
              </div>
              <div>
                <p className="text-[11px] text-[#e9edef] font-medium">{content?.contactName || "Contato"}</p>
                <p className="text-[9px] text-[#8696a0]">{content?.contactPhone || "+55..."}</p>
              </div>
            </div>
            <div className="w-full text-center py-1 mt-0.5">
              <span className="text-[10px] text-[#53bdeb]">Enviar mensagem</span>
            </div>
          </div>
        );

      case "poll":
        return (
          <div className="min-w-[180px] space-y-1.5">
            <div className="flex items-center gap-1">
              <BarChart3 className="h-2.5 w-2.5 text-[#00a884]" />
              <span className="text-[8px] text-[#00a884] uppercase font-medium tracking-wide">Enquete</span>
            </div>
            <p className="text-[11px] text-[#e9edef] font-medium">{content?.question || "Pergunta?"}</p>
            <div className="space-y-0.5">
              {(content?.options || []).filter(Boolean).map((opt: string, i: number) => (
                <div key={i} className="flex items-center gap-1.5 p-1 rounded bg-[#1d2a21] border border-white/5">
                  <div className="h-3 w-3 rounded-full border border-[#8696a0] shrink-0" />
                  <span className="text-[10px] text-[#e9edef]">{opt}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "list":
        return (
          <div className="min-w-[180px] space-y-1.5">
            <p className="text-[11px] text-[#e9edef] font-medium">{content?.title || "Lista"}</p>
            {content?.description && <p className="text-[10px] text-[#8696a0]">{content.description}</p>}
            <button className="w-full py-1.5 rounded bg-[#1d2a21] border border-white/10 flex items-center justify-center gap-1">
              <List className="h-2.5 w-2.5 text-[#53bdeb]" />
              <span className="text-[10px] text-[#53bdeb]">{content?.buttonText || "Ver opções"}</span>
            </button>
            {content?.footer && <p className="text-[8px] text-[#8696a0] text-center">{content.footer}</p>}
          </div>
        );

      default:
        return <span className="text-[11px] text-[#8696a0]">Mensagem</span>;
    }
  };

  const isSticker = messageType === "sticker";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: "#0b141a" }}>
      {/* WhatsApp Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ background: "#202c33" }}>
        <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: "#374045" }}>
          <MessageSquare className="h-3 w-3 text-[#8696a0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#e9edef] font-medium truncate">Preview do Grupo</p>
          <p className="text-[8px] text-[#8696a0]">membros do grupo</p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="h-3 w-3 text-[#8696a0]" />
          <MoreVertical className="h-3 w-3 text-[#8696a0]" />
        </div>
      </div>

      {/* Chat area - scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 flex flex-col justify-end"
        style={{
          background: "#0b141a",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      >
        {!hasContent() ? (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 text-[#8696a0]/40">
            <Sparkles className="h-6 w-6" />
            <p className="text-[9px] text-center leading-tight">
              Componha uma mensagem<br />para ver o preview
            </p>
          </div>
        ) : (
          <div className="flex justify-end">
            <div className={`relative max-w-[240px] ${isSticker ? "" : "rounded-lg rounded-tr-none p-1.5 shadow-sm"}`}
              style={isSticker ? {} : { background: "#005c4b" }}
            >
              {!isSticker && (
                <div className="absolute -right-1.5 top-0 w-0 h-0" style={{ borderLeft: "6px solid #005c4b", borderTop: "6px solid transparent" }} />
              )}
              {renderBubbleContent()}
              {!isSticker && (
                <div className="flex items-center justify-end gap-0.5 mt-0.5">
                  <span className="text-[8px] text-[#ffffff99]">12:00</span>
                  <CheckCheck className="h-2.5 w-2.5 text-[#53bdeb]" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0" style={{ background: "#202c33" }}>
        <div className="flex-1 h-6 rounded-full flex items-center px-2.5" style={{ background: "#2a3942" }}>
          <span className="text-[9px] text-[#8696a0]">Digite uma mensagem</span>
        </div>
        <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "#00a884" }}>
          <Mic className="h-3 w-3 text-[#0b141a]" />
        </div>
      </div>
    </div>
  );
}
