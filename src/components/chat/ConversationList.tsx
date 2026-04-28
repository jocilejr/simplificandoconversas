import { useMemo } from "react";
import { ChatConversation } from "@/hooks/useConversationsLive";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MessageCircle } from "lucide-react";
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
  return src.slice(0, 2).toUpperCase();
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
    <div className="flex flex-col h-full border-r border-border bg-card/30">
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar contato ou telefone"
            className="pl-8 h-9 text-xs"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={instanceFilter} onValueChange={onInstanceFilterChange}>
            <SelectTrigger className="h-8 text-xs">
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
            <SelectTrigger className="h-8 text-xs">
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
          <div className="p-2 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <MessageCircle className="h-8 w-8 opacity-50" />
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
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex gap-3 items-start hover:bg-accent/40 border-l-2 transition-colors",
                    isActive ? "bg-accent/60 border-l-primary" : "border-l-transparent"
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-semibold">
                      {initials(c.contact_name, c.phone_number)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{display}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground truncate">
                        {c.last_message || "—"}
                      </span>
                      {c.unread_count > 0 && (
                        <Badge className="h-4 px-1.5 text-[9px] bg-primary text-primary-foreground">
                          {c.unread_count}
                        </Badge>
                      )}
                    </div>
                    {c.instance_name && (
                      <span className="text-[9px] text-muted-foreground/70 mt-0.5 block truncate">
                        via {c.instance_name}
                      </span>
                    )}
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
