import { useMemo, useState, useEffect } from "react";
import {
  Sparkles, Play, Mic, MapPin, User, BarChart3, List,
  CheckCheck, File,
} from "lucide-react";

export interface WhatsAppPreviewProps {
  messageType: string;
  textContent?: string;
  mediaUrl?: string;
  caption?: string;
  locName?: string;
  locAddress?: string;
  locLat?: string;
  locLng?: string;
  contactName?: string;
  contactPhone?: string;
  pollName?: string;
  pollOptions?: string[];
  listTitle?: string;
  listDescription?: string;
  listButtonText?: string;
  listFooter?: string;
  listSections?: { title: string; rows: { title: string; description: string }[] }[];
  mentionAll?: boolean;
  forceLinkPreview?: boolean;
  compact?: boolean;
}

function TimeStamp() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5 align-bottom whitespace-nowrap" style={{ float: 'right', marginTop: '3px' }}>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>12:00</span>
      <CheckCheck style={{ width: '14px', height: '14px', color: '#53bdeb' }} />
    </span>
  );
}

function Bubble({ children, noBubble = false }: { children: React.ReactNode; noBubble?: boolean }) {
  if (noBubble) {
    return <div className="flex justify-end px-3 py-0.5">{children}</div>;
  }
  return (
    <div className="flex justify-end px-[18px] py-[1px]">
      <div
        style={{
          backgroundColor: '#005c4b',
          borderRadius: '7.5px',
          borderTopRightRadius: 0,
          maxWidth: '95%',
          padding: '6px 7px 8px 9px',
          position: 'relative',
          boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
        }}
      >
        <svg
          viewBox="0 0 8 13"
          height="13"
          width="8"
          style={{ position: 'absolute', top: 0, right: '-8px' }}
        >
          <path opacity=".13" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
          <path fill="#005c4b" d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z" />
        </svg>
        {children}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '180px' }}>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center' }}>
        Componha uma mensagem<br />para ver o preview
      </p>
    </div>
  );
}

const WAVEFORM_HEIGHTS = Array.from({ length: 30 }, (_, i) =>
  Math.sin(i * 0.6) * 10 + Math.cos(i * 1.2) * 5 + 8
);

function formatWhatsAppText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /```([\s\S]*?)```|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<code key={key++} style={{ fontFamily: 'monospace', fontSize: '13px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', padding: '1px 3px' }}>{match[1]}</code>);
    } else if (match[2] !== undefined) {
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      parts.push(<del key={key++}>{match[4]}</del>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

const URL_REGEX = /https?:\/\/[^\s]+/i;

function LinkPreviewCard({ url }: { url: string }) {
  const [ogData, setOgData] = useState<{ image?: string; title?: string; domain?: string } | null>(null);

  const domain = useMemo(() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  }, [url]);

  useEffect(() => {
    setOgData(null);
    const controller = new AbortController();
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(res => {
        if (res.status === 'success' && res.data) {
          setOgData({
            image: res.data.image?.url || res.data.logo?.url,
            title: res.data.title,
            domain: res.data.publisher || domain,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [url, domain]);

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  return (
    <div style={{ borderRadius: '6px', overflow: 'hidden', marginBottom: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ background: '#0b141a', position: 'relative', overflow: 'hidden' }}>
        {ogData?.image ? (
          <img
            src={ogData.image}
            alt=""
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={faviconUrl} alt="" style={{ width: '32px', height: '32px', opacity: 0.4 }} />
          </div>
        )}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img
          src={faviconUrl}
          alt=""
          style={{ width: '16px', height: '16px', borderRadius: '2px', flexShrink: 0 }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'lowercase', lineHeight: 1.2 }}>{domain}</p>
          <p style={{ fontSize: '12.5px', color: '#e9edef', fontWeight: 500, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ogData?.title || domain.charAt(0).toUpperCase() + domain.slice(1)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppPreview(props: WhatsAppPreviewProps) {
  const {
    messageType, textContent, mediaUrl, caption,
    locName, locAddress, locLat, locLng,
    contactName, contactPhone, pollName, pollOptions,
    listTitle, listDescription, listButtonText, listFooter,
    mentionAll, forceLinkPreview, compact,
  } = props;

  const detectedUrl = useMemo(() => {
    if (messageType === 'text' && textContent && forceLinkPreview !== false) {
      const match = textContent.match(URL_REGEX);
      return match ? match[0] : null;
    }
    return null;
  }, [messageType, textContent, forceLinkPreview]);

  const compactScale = 0.82;
  const [compactContentEl, setCompactContentEl] = useState<HTMLDivElement | null>(null);
  const [compactContentHeight, setCompactContentHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!compact) {
      setCompactContentHeight(null);
      return;
    }

    if (!compactContentEl) return;

    const updateHeight = () => {
      const nextHeight = Math.ceil(compactContentEl.scrollHeight * compactScale);
      setCompactContentHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => updateHeight());
    resizeObserver.observe(compactContentEl);

    const mediaElements = Array.from(compactContentEl.querySelectorAll("img, video"));
    mediaElements.forEach((element) => {
      const eventName = element.tagName === "VIDEO" ? "loadedmetadata" : "load";
      element.addEventListener(eventName, updateHeight);
    });

    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver.disconnect();
      mediaElements.forEach((element) => {
        const eventName = element.tagName === "VIDEO" ? "loadedmetadata" : "load";
        element.removeEventListener(eventName, updateHeight);
      });
      window.removeEventListener("resize", updateHeight);
    };
  }, [compact, compactContentEl]);

  const hasContent = () => {
    switch (messageType) {
      case "text": return !!textContent?.trim();
      case "image": case "video": case "document": case "audio": case "sticker": return !!mediaUrl;
      case "location": return !!locLat && !!locLng;
      case "contact": return !!contactName;
      case "poll": return !!pollName;
      case "list": return !!listTitle;
      default: return false;
    }
  };

  const renderContent = () => {
    switch (messageType) {
      case "text":
        return (
          <Bubble>
            {detectedUrl && <LinkPreviewCard url={detectedUrl} />}
            {mentionAll && <span style={{ color: '#53bdeb', fontSize: '14.2px' }}>@todos </span>}
            <span style={{ fontSize: '14.2px', color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '19px' }}>
              {formatWhatsAppText(textContent || '')}
            </span>
            <TimeStamp />
          </Bubble>
        );

      case "image":
        return (
          <Bubble>
            <div style={{ borderRadius: '6px', overflow: 'hidden', marginBottom: caption ? '4px' : '0' }}>
              <img src={mediaUrl} alt="" style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>
            {mentionAll && <span style={{ color: '#53bdeb', fontSize: '14.2px' }}>@todos </span>}
            {caption && (
              <span style={{ fontSize: '14.2px', color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '19px' }}>
                {formatWhatsAppText(caption)}
              </span>
            )}
            <TimeStamp />
          </Bubble>
        );

      case "video":
        return (
          <Bubble>
            <div style={{ borderRadius: '6px', overflow: 'hidden', marginBottom: caption ? '4px' : '0', height: '140px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.5))' }} />
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <Play style={{ width: '20px', height: '20px', color: 'white', fill: 'white', marginLeft: '2px' }} />
              </div>
            </div>
            {mentionAll && <span style={{ color: '#53bdeb', fontSize: '14.2px' }}>@todos </span>}
            {caption && (
              <span style={{ fontSize: '14.2px', color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '19px' }}>
                {formatWhatsAppText(caption)}
              </span>
            )}
            <TimeStamp />
          </Bubble>
        );

      case "audio":
        return (
          <Bubble>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#374045', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User style={{ width: '20px', height: '20px', color: '#8696a0' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Play style={{ width: '16px', height: '16px', color: '#8696a0', flexShrink: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'end', gap: '1px', flex: 1, height: '24px' }}>
                    {WAVEFORM_HEIGHTS.map((h, i) => (
                      <div key={i} style={{ width: '3px', borderRadius: '1.5px', background: '#8696a0', height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>0:00</span>
                  <Mic style={{ width: '14px', height: '14px', color: '#53bdeb' }} />
                </div>
              </div>
            </div>
            <TimeStamp />
          </Bubble>
        );

      case "document":
        return (
          <Bubble>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '10px', marginBottom: caption ? '4px' : '0' }}>
              <div style={{ width: '36px', height: '44px', background: '#374045', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <File style={{ width: '18px', height: '18px', color: '#8696a0' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', color: '#e9edef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mediaUrl?.split("/").pop() || "documento.pdf"}
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>PDF</p>
              </div>
            </div>
            {caption && (
              <span style={{ fontSize: '14.2px', color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '19px' }}>
                {formatWhatsAppText(caption)}
              </span>
            )}
            <TimeStamp />
          </Bubble>
        );

      case "sticker":
        return (
          <Bubble noBubble>
            <div style={{ width: '140px', height: '140px' }}>
              <img src={mediaUrl} alt="sticker" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </Bubble>
        );

      case "location":
        return (
          <Bubble>
            <div style={{ borderRadius: '6px', overflow: 'hidden', marginBottom: '4px', background: '#1a2a1e' }}>
              <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a2e1e 0%, #0b141a 100%)' }}>
                <MapPin style={{ width: '28px', height: '28px', color: '#25d366' }} />
              </div>
              <div style={{ padding: '8px 10px' }}>
                {locName && <p style={{ fontSize: '13px', color: '#e9edef', fontWeight: 500 }}>{locName}</p>}
                {locAddress && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>{locAddress}</p>}
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{locLat}, {locLng}</p>
              </div>
            </div>
            <TimeStamp />
          </Bubble>
        );

      case "contact":
        return (
          <Bubble>
            <div style={{ minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#374045', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User style={{ width: '20px', height: '20px', color: '#8696a0' }} />
                </div>
                <div>
                  <p style={{ fontSize: '14px', color: '#e9edef', fontWeight: 500 }}>{contactName || "Contato"}</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{contactPhone || "+55..."}</p>
                </div>
              </div>
              <div style={{ textAlign: 'center', paddingTop: '8px' }}>
                <span style={{ fontSize: '13px', color: '#53bdeb' }}>Enviar mensagem</span>
              </div>
            </div>
            <TimeStamp />
          </Bubble>
        );

      case "poll":
        return (
          <Bubble>
            <div style={{ minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <BarChart3 style={{ width: '14px', height: '14px', color: '#25d366' }} />
                <span style={{ fontSize: '11px', color: '#25d366', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Enquete</span>
              </div>
              <p style={{ fontSize: '14.2px', color: '#e9edef', fontWeight: 500, marginBottom: '8px' }}>{pollName || "Pergunta?"}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(pollOptions || []).filter(Boolean).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #8696a0', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: '#e9edef' }}>{opt}</span>
                  </div>
                ))}
              </div>
            </div>
            <TimeStamp />
          </Bubble>
        );

      case "list":
        return (
          <Bubble>
            <div style={{ minWidth: '220px' }}>
              <p style={{ fontSize: '14.2px', color: '#e9edef', fontWeight: 500 }}>{listTitle || "Lista"}</p>
              {listDescription && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>{listDescription}</p>}
              <button style={{ width: '100%', padding: '8px', marginTop: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
                <List style={{ width: '14px', height: '14px', color: '#53bdeb' }} />
                <span style={{ fontSize: '13px', color: '#53bdeb' }}>{listButtonText || "Ver opções"}</span>
              </button>
              {listFooter && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '4px' }}>{listFooter}</p>}
            </div>
            <TimeStamp />
          </Bubble>
        );

      default:
        return null;
    }
  };

  const wallpaperStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M60 60l20-20v20H60zm80 0l20-20v20h-20zm80 0l20-20v20h-20zM60 140l20-20v20H60zm80 0l20-20v20h-20zm80 0l20-20v20h-20zM60 220l20-20v20H60zm80 0l20-20v20h-20zm80 0l20-20v20h-20z'/%3E%3C/g%3E%3C/svg%3E")`,
    backgroundColor: '#0b141a',
  };

  if (compact) {
    return (
      <div
        style={{
          height: compactContentHeight ? `${compactContentHeight}px` : undefined,
          overflow: 'hidden',
        }}
      >
        <div
          ref={setCompactContentEl}
          style={{
            transform: `scale(${compactScale})`,
            transformOrigin: 'top left',
            width: `${100 / compactScale}%`,
          }}
        >
          <div className="flex flex-col w-full" style={{ backgroundColor: '#0b141a' }}>
            <div style={{ ...wallpaperStyle, padding: '10px 0' }}>
              {!hasContent() ? <EmptyState /> : <div className="py-1">{renderContent()}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full rounded-xl overflow-hidden shadow-lg" style={{ border: '1px solid rgba(255,255,255,0.06)', minHeight: '300px' }}>
      <div style={{ background: '#202c33', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#374045', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User style={{ width: '18px', height: '18px', color: '#8696a0' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '14px', color: '#e9edef', fontWeight: 500 }}>Preview do Grupo</p>
          <p style={{ fontSize: '12px', color: '#8696a0' }}>membros do grupo</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ ...wallpaperStyle, padding: '12px 0' }}>
        {!hasContent() ? <EmptyState /> : <div className="py-2">{renderContent()}</div>}
      </div>
      <div style={{ background: '#202c33', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '36px', borderRadius: '18px', background: '#2a3942', display: 'flex', alignItems: 'center', paddingLeft: '14px' }}>
          <span style={{ fontSize: '13px', color: '#8696a0' }}>Digite uma mensagem</span>
        </div>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mic style={{ width: '18px', height: '18px', color: '#0b141a' }} />
        </div>
      </div>
    </div>
  );
}
