import { useState, useEffect } from "react";
import {
  MessageSquare, Image, Video, Mic, FileText, Sticker, MapPin,
  Contact, BarChart3, List, Check, CheckCheck, Sparkles, Send,
  Phone, ExternalLink, Play, FileIcon, User
} from "lucide-react";

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
  let formatted = text
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    .replace(/```([^`]+)```/g, '<code class="bg-black/30 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, '<br/>');
  return formatted;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function WhatsAppPreview({ messageType, content, mentionAll, forceLinkPreview }: Props) {
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [url, forceLinkPreview, messageType]);

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
              <div className="rounded-lg overflow-hidden mb-1.5 border border-white/5">
                {linkPreview.image && (
                  <div className="w-full h-[130px] bg-black/20 overflow-hidden">
                    <img src={linkPreview.image} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-2 bg-[#1a2b33]">
                  <p className="text-[11px] text-[#8696a0] uppercase tracking-wide">{getDomain(url!)}</p>
                  <p className="text-[12px] text-[#e9edef] font-medium leading-tight mt-0.5 line-clamp-2">
                    {linkPreview.title}
                  </p>
                  {linkPreview.description && (
                    <p className="text-[11px] text-[#8696a0] leading-tight mt-0.5 line-clamp-2">
                      {linkPreview.description}
                    </p>
                  )}
                </div>
              </div>
            )}
            {loadingPreview && (
              <div className="rounded-lg p-3 mb-1.5 bg-[#1a2b33] animate-pulse">
                <div className="h-2 bg-white/10 rounded w-20 mb-1.5" />
                <div className="h-2.5 bg-white/10 rounded w-full mb-1" />
                <div className="h-2 bg-white/10 rounded w-3/4" />
              </div>
            )}
            {mentionAll && (
              <span className="text-[#53bdeb] text-[13px]">@todos </span>
            )}
            <span
              className="text-[13px] text-[#e9edef] leading-[19px] break-words"
              dangerouslySetInnerHTML={{ __html: formatWhatsAppText(text) }}
            />
          </div>
        );

      case "image":
        return (
          <div className="space-y-1">
            <div className="w-full h-[160px] bg-[#1a2b33] rounded-md overflow-hidden flex items-center justify-center">
              {content?.mediaUrl ? (
                <img src={content.mediaUrl} alt="" className="w-full h-full object-cover" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex flex-col items-center gap-1 text-[#8696a0]"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-[10px]">Imagem</span></div>';
                }} />
              ) : (
                <div className="flex flex-col items-center gap-1 text-[#8696a0]">
                  <Image className="h-7 w-7" />
                  <span className="text-[10px]">Imagem</span>
                </div>
              )}
            </div>
            {mentionAll && <span className="text-[#53bdeb] text-[13px]">@todos </span>}
            {content?.caption && (
              <p className="text-[13px] text-[#e9edef]">{content.caption}</p>
            )}
          </div>
        );

      case "video":
        return (
          <div className="space-y-1">
            <div className="w-full h-[160px] bg-[#1a2b33] rounded-md overflow-hidden flex items-center justify-center relative">
              <Video className="h-7 w-7 text-[#8696a0]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
                  <Play className="h-5 w-5 text-white ml-0.5" />
                </div>
              </div>
            </div>
            {mentionAll && <span className="text-[#53bdeb] text-[13px]">@todos </span>}
            {content?.caption && (
              <p className="text-[13px] text-[#e9edef]">{content.caption}</p>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="flex items-center gap-2 min-w-[220px]">
            <div className="h-10 w-10 rounded-full bg-[#00a884] flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1">
                <Play className="h-4 w-4 text-[#8696a0]" />
                <div className="flex-1 h-[6px] bg-[#2a3942] rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-[#8696a0] rounded-full" />
                </div>
              </div>
              <p className="text-[10px] text-[#8696a0]">0:00</p>
            </div>
            {mentionAll && <span className="text-[#53bdeb] text-[11px] shrink-0">@todos</span>}
          </div>
        );

      case "document":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 p-2.5 bg-[#1a2b33] rounded-lg">
              <div className="h-9 w-9 rounded bg-[#c5a55a]/20 flex items-center justify-center shrink-0">
                <FileIcon className="h-5 w-5 text-[#c5a55a]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#e9edef] truncate">
                  {content?.mediaUrl?.split("/").pop() || "documento.pdf"}
                </p>
                <p className="text-[10px] text-[#8696a0]">PDF • 1 página</p>
              </div>
            </div>
            {content?.caption && (
              <p className="text-[13px] text-[#e9edef]">{content.caption}</p>
            )}
          </div>
        );

      case "sticker":
        return (
          <div className="w-[120px] h-[120px] flex items-center justify-center">
            {content?.mediaUrl ? (
              <img src={content.mediaUrl} alt="sticker" className="max-w-full max-h-full" />
            ) : (
              <Sticker className="h-16 w-16 text-[#8696a0]/50" />
            )}
          </div>
        );

      case "location":
        return (
          <div className="space-y-1">
            <div className="w-full h-[120px] bg-[#1a2b33] rounded-md flex items-center justify-center">
              <MapPin className="h-8 w-8 text-[#00a884]" />
            </div>
            {content?.name && (
              <p className="text-[13px] text-[#e9edef] font-medium">{content.name}</p>
            )}
            {content?.address && (
              <p className="text-[11px] text-[#8696a0]">{content.address}</p>
            )}
          </div>
        );

      case "contact":
        return (
          <div className="min-w-[200px]">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <div className="h-9 w-9 rounded-full bg-[#2a3942] flex items-center justify-center">
                <User className="h-5 w-5 text-[#8696a0]" />
              </div>
              <div>
                <p className="text-[13px] text-[#e9edef] font-medium">{content?.contactName || "Contato"}</p>
                <p className="text-[11px] text-[#8696a0]">{content?.contactPhone || "+55..."}</p>
              </div>
            </div>
            <button className="w-full text-center py-1.5 mt-1">
              <span className="text-[12px] text-[#53bdeb]">Enviar mensagem</span>
            </button>
          </div>
        );

      case "poll":
        return (
          <div className="min-w-[220px] space-y-2">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-[#00a884]" />
              <span className="text-[10px] text-[#00a884] uppercase font-medium tracking-wide">Enquete</span>
            </div>
            <p className="text-[13px] text-[#e9edef] font-medium">{content?.question || "Pergunta?"}</p>
            <div className="space-y-1">
              {(content?.options || []).filter(Boolean).map((opt: string, i: number) => (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-[#1a2b33] border border-white/5">
                  <div className="h-4 w-4 rounded-full border border-[#8696a0] shrink-0" />
                  <span className="text-[12px] text-[#e9edef]">{opt}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "list":
        return (
          <div className="min-w-[220px] space-y-2">
            <p className="text-[13px] text-[#e9edef] font-medium">{content?.title || "Lista"}</p>
            {content?.description && (
              <p className="text-[12px] text-[#8696a0]">{content.description}</p>
            )}
            <button className="w-full py-2 rounded-lg bg-[#1a2b33] border border-white/10 flex items-center justify-center gap-1.5">
              <List className="h-3.5 w-3.5 text-[#53bdeb]" />
              <span className="text-[12px] text-[#53bdeb]">{content?.buttonText || "Ver opções"}</span>
            </button>
            {content?.footer && (
              <p className="text-[10px] text-[#8696a0] text-center">{content.footer}</p>
            )}
          </div>
        );

      default:
        return <span className="text-[13px] text-[#8696a0]">Mensagem</span>;
    }
  };

  const isSticker = messageType === "sticker";

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-white/5 bg-[#0b141a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#202c33]">
        <div className="h-8 w-8 rounded-full bg-[#2a3942] flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-[#8696a0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[#e9edef] font-medium truncate">Preview do Grupo</p>
          <p className="text-[10px] text-[#8696a0]">membros do grupo</p>
        </div>
      </div>

      {/* Chat area */}
      <div
        className="flex-1 p-4 overflow-y-auto flex flex-col justify-end"
        style={{
          backgroundColor: "#060a0e",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {!hasContent() ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#8696a0]/60">
            <Sparkles className="h-8 w-8" />
            <p className="text-[11px] text-center leading-tight">
              Componha uma mensagem<br />para ver o preview
            </p>
          </div>
        ) : (
          <div className="flex justify-end">
            <div
              className={`relative max-w-[280px] ${
                isSticker
                  ? ""
                  : "bg-[#005c4b] rounded-lg rounded-tr-none p-2 shadow-md"
              }`}
            >
              {/* Tail */}
              {!isSticker && (
                <div
                  className="absolute -right-2 top-0 w-0 h-0"
                  style={{
                    borderLeft: "8px solid #005c4b",
                    borderTop: "8px solid transparent",
                  }}
                />
              )}

              {renderBubbleContent()}

              {/* Timestamp + checks */}
              {!isSticker && (
                <div className="flex items-center justify-end gap-0.5 mt-1">
                  <span className="text-[10px] text-[#ffffff99]">12:00</span>
                  <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#202c33]">
        <div className="flex-1 h-8 rounded-full bg-[#2a3942] flex items-center px-3">
          <span className="text-[12px] text-[#8696a0]">Digite uma mensagem</span>
        </div>
        <div className="h-8 w-8 rounded-full bg-[#00a884] flex items-center justify-center">
          <Mic className="h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  );
}
