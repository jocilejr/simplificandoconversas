import { useMemo } from "react";
import { ChatConversation } from "@/hooks/useConversationsLive";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MessageCircle, Cpu } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Label as LabelType } from "@/hooks/useLabels";

interface Props {
  conversations: ChatConversation[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (c: ChatConversation) => void;
  instances: Array<{ instance_name: string }>;
  instanceFilter: string;
  onInstanceFilterChange: (v: string) => void;
  labels: LabelType[];
  labelFilter: string;
  onLabelFilterChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

function initials(name: string | null, phone: string | null) {
  const src = (name || phone || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// Deterministic color per instance name to create a subtle visual marker
const INSTANCE_HUES = [210, 280, 150, 25, 340, 190, 55, 320];
function instanceColor(name: string | null | undefined): string {
  if (!name) return "hsl(215 10% 50%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = INSTANCE_HUES[Math.abs(hash) % INSTANCE_HUES.length];
  return `hsl(${hue} 65% 55%)`;
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
}: Props) {
  const uniqueInstances = useMemo(() => {
    const names = new Set(instances.map((i) => i.instance_name));
    return Array.from(names);
  }, [instances]);

  return (
    <div className="flex flex-col h-full border-r border-border bg-card/40">
      <div className="px-3 pt-3 pb-2.5 space-y-2 border-b border-border">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
            Conversas
          </span>
          <span className="text-[10px] text-muted-foreground">
            {conversations.length}
          </span>
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
          <Select value={instanceFilter} onValueChange={onInstanceFilterChange}>
            <SelectTrigger className="h-8 text-[11px] bg-background/60">
              <SelectValue placeholder="Instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas instâncias</SelectItem>
              {uniqueInstances.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={labelFilter} onValueChange={onLabelFilterChange}>
            <SelectTrigger className="h-8 text-[11px] bg-background/60">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas etiquetas</SelectItem>
              {labels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
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
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <MessageCircle className="h-8 w-8 opacity-40" />
            <p className="text-xs">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="py-1">
            {conversations.map((c) => {
              const isActive = c.id === selectedId;
              const display = c.contact_name || c.phone_number || c.remote_jid;
              const timeAgo = c.last_message_at
                ? formatDistanceToNowStrict(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })
                : "";
              const instColor = instanceColor(c.instance_name);
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex gap-2.5 items-start transition-colors relative group border-l-2",
                    isActive
                      ? "bg-primary/10 border-l-primary"
                      : "border-l-transparent hover:bg-accent/40"
                  )}
                >
                  <Avatar className="h-10 w-10 ring-1 ring-border shrink-0">
                    <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">
                      {initials(c.contact_name, c.phone_number)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-xs truncate", isActive ? "font-semibold" : "font-medium")}>
                        {display}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {timeAgo}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {c.instance_name && (
                        <span
                          className="inline-flex items-center px-1.5 py-[1px] rounded text-[9px] font-semibold shrink-0 max-w-[110px] truncate"
                          style={{
                            background: instColor.replace("55%)", "18%)"),
                            color: instColor,
                          }}
                          title={`Instância: ${c.instance_name}`}
                        >
                          <span className="truncate">{c.instance_name}</span>
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground truncate flex-1">
                        {c.last_message || "—"}
                      </span>
                      {c.unread_count > 0 && (
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
    </div>
  );
}
