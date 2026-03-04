import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { MessageSquare, Loader2, RefreshCw, Search } from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { ContactAvatar } from "./ContactAvatar";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

interface ConversationListProps {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  selected: Conversation | null;
  onSelect: (conv: Conversation) => void;
  onSync: () => void;
  isSyncing: boolean;
  contactPhotos: Record<string, string>;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yy");
}

function formatJid(jid: string) {
  return jid.split("@")[0];
}

export function ConversationList({
  conversations,
  isLoading,
  selected,
  onSelect,
  onSync,
  isSyncing,
  contactPhotos,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations?.filter(
    (c) =>
      (c.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
      c.remote_jid.includes(search)
  );

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Search bar */}
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          onClick={onSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Sincronizar conversas
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !filtered?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
            <span className="text-sm">Nenhuma conversa</span>
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors hover:bg-accent/50 flex items-center gap-3 border-b border-border/50",
                selected?.id === conv.id && "bg-accent"
              )}
            >
              <ContactAvatar
                photoUrl={contactPhotos[conv.remote_jid]}
                name={conv.contact_name}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {conv.unread_count > 0 && (
                      <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                    )}
                    <span className="font-semibold text-sm truncate">
                      {conv.contact_name || formatJid(conv.remote_jid)}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {formatTime(conv.last_message_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {conv.last_message || "..."}
                </p>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
