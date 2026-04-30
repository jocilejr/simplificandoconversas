import { useMemo, useState, useRef, useEffect } from "react";
import { ChatConversation } from "@/hooks/useConversationsLive";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MessageCircle, Users, MessagesSquare, BellDot, ChevronDown, Check } from "lucide-react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Label as LabelType } from "@/hooks/useLabels";

interface Props {
  conversations: ChatConversation[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (c: ChatConversation) => void;
  instances: Array<{ instance_name: string }>;
  instanceFilter: string[];
  onInstanceFilterChange: (v: string[]) => void;
  labels: LabelType[];
  labelFilter: string;
  onLabelFilterChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

function initials(name: string | null, phone: string | null) {
  const src = (name || phone || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const INSTANCE_HUES = [210, 280, 150, 25, 340, 190, 55, 320];
function instanceColor(name: string | null | undefined): string {
  if (!name) return "hsl(215 10% 50%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = INSTANCE_HUES[Math.abs(hash) % INSTANCE_HUES.length];
  return `hsl(${hue} 65% 55%)`;
}

function truncateMessage(text: string | null | undefined, max?: number): string {
  const m = max || 15;
  if (!text) return String.fromCharCode(8212);
  const flat = text.split(String.fromCharCode(10)).join(" ").trim();
  return flat.length > m ? flat.slice(0, m) + String.fromCharCode(8230) : flat;
}

type Tab = "conversas" | "grupos";


function InstanceMultiSelect({
  instances,
  selected,
  onChange,
}: {
  instances: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  const label =
    selected.length === 0
      ? "Todas instancias"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} instancias`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-8 flex items-center justify-between gap-1 px-2 rounded border border-input bg-background/60 text-[11px] text-left hover:bg-accent/40 transition-colors"
      >
        <span className="truncate flex-1 min-w-0">{label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[160px] max-h-64 overflow-y-auto rounded border border-border bg-popover shadow-md py-0.5">
          <button
            type="button"
            onClick={() => { onChange([]); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-accent/50 transition-colors"
          >
            <Check className={cn("h-3 w-3 shrink-0", selected.length === 0 ? "opacity-100 text-primary" : "opacity-0")} />
            Todas instancias
          </button>
          {instances.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-accent/50 transition-colors"
            >
              <Check className={cn("h-3 w-3 shrink-0", selected.includes(name) ? "opacity-100 text-primary" : "opacity-0")} />
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  instances,
  instanceFilter,
  onInstanceFilterChange,
  labels,
  labelFilter,
  onLabelFilterChange,
  search,
  onSearchChange,
  hasMore,
  onLoadMore,
}: Props) {
  const [tab, setTab] = useState<Tab>("conversas");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const uniqueInstances = useMemo(() => {
    const names = new Set(instances.map((i) => i.instance_name));
    return Array.from(names);
  }, [instances]);

  const groupCount = useMemo(() => conversations.filter((c) => c.remote_jid.endsWith("@g.us")).length, [conversations]);
  const convCount = useMemo(() => conversations.filter((c) => !c.remote_jid.endsWith("@g.us")).length, [conversations]);

  const filtered = useMemo(() => {
    let list = tab === "grupos"
      ? conversations.filter((c) => c.remote_jid.endsWith("@g.us"))
      : conversations.filter((c) => !c.remote_jid.endsWith("@g.us"));
    if (onlyUnread) list = list.filter((c) => c.unread_count > 0);
    return list;
  }, [conversations, tab, onlyUnread]);

  return (
    <div className="flex flex-col h-full border-r border-border bg-card/40">
      <div className="px-3 pt-3 pb-2.5 space-y-2 border-b border-border">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab("conversas")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-medium transition-colors touch-manipulation",
              tab === "conversas"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <MessagesSquare className="h-3 w-3" />
            Conversas
            <span className="text-[9px] opacity-70">({convCount})</span>
          </button>
          <button
            onClick={() => setTab("grupos")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-medium transition-colors touch-manipulation",
              tab === "grupos"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <Users className="h-3 w-3" />
            Grupos
            <span className="text-[9px] opacity-70">({groupCount})</span>
          </button>
          <button
            onClick={() => setOnlyUnread((v) => !v)}
            title="Filtrar nao lidas"
            className={cn(
              "p-1.5 rounded transition-colors touch-manipulation",
              onlyUnread
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <BellDot className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar contato ou telefone"
            className="pl-8 h-9 text-xs bg-background/60"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <InstanceMultiSelect
            instances={uniqueInstances}
            selected={instanceFilter}
            onChange={onInstanceFilterChange}
          />
          <Select value={labelFilter} onValueChange={onLabelFilterChange}>
            <SelectTrigger className="h-8 text-[11px] bg-background/60">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas etiquetas</SelectItem>
              {labels.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-2 space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[62px] w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <MessageCircle className="h-8 w-8 opacity-40" />
            <p className="text-xs">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((c) => {
              const isActive = c.id === selectedId;
              const rawDisplay = c.contact_name || c.phone_number || c.remote_jid;
              const display = rawDisplay && rawDisplay.length > 25 ? rawDisplay.slice(0, 25) + "…" : rawDisplay;
              const timeAgo = c.last_message_at
                ? formatDistanceToNowStrict(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })
                : "";
              const instColor = instanceColor(c.instance_name);
              const firstContact = c.created_at
                ? "Primeiro contato: " + format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })
                : "";
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  title={firstContact}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex gap-2.5 items-start transition-colors relative group border-l-2 touch-manipulation overflow-hidden",
                    isActive
                      ? "bg-primary/10 border-l-primary"
                      : "border-l-transparent hover:bg-accent/40"
                  )}
                >
                  <Avatar className="h-10 w-10 ring-1 ring-border shrink-0">
                    {c.profile_pic_url && <AvatarImage src={c.profile_pic_url} alt={c.contact_name || c.phone_number || ""} />}
                    <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">
                      {initials(c.contact_name, c.phone_number)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-xs truncate min-w-0", isActive ? "font-semibold" : "font-medium")}>
                        {display}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {timeAgo}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 min-w-0 overflow-hidden">
                      {c.instance_name && (
                        <span
                          className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-semibold shrink-0 max-w-[110px] truncate"
                          style={{
                            background: instColor.replace("55%)", "18%)"),
                            color: instColor,
                          }}
                          title={`Instancia: ${c.instance_name}`}
                        >
                          <span className="truncate">{c.instance_name}</span>
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground truncate flex-1 min-w-0">
                        {truncateMessage(c.last_message)}
                      </span>
                      {c.unread_count > 0 && !isActive && (
                        <Badge className="h-[18px] min-w-[18px] px-1.5 text-[9px] bg-primary text-primary-foreground rounded-full flex items-center justify-center shrink-0">
                          {c.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
      {hasMore && onLoadMore && (
        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={onLoadMore}
            className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1.5 rounded touch-manipulation"
          >
            Carregar mais conversas
          </button>
        </div>
      )}
    </div>
  );
}
