import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Search, MessageSquare, ChevronDown, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Conversation } from "@/hooks/useConversations";
import { ContactAvatar } from "./ContactAvatar";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

interface InstanceTab {
  name: string;
  label: string;
}

interface ConversationListProps {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  selected: Conversation | null;
  onSelect: (conv: Conversation) => void;
  onSync: () => void;
  onDelete: (conv: Conversation) => void;
  isSyncing: boolean;
  contactPhotos: Record<string, string>;
  instances?: InstanceTab[];
  selectedInstance: string | null;
  onSelectInstance: (name: string | null) => void;
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
  onDelete,
  isSyncing,
  contactPhotos,
  instances = [],
  selectedInstance,
  onSelectInstance,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations?.filter((c) => {
    const matchSearch =
      (c.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
      c.remote_jid.includes(search);
    const matchInstance =
      !selectedInstance || c.instance_name === selectedInstance;
    return matchSearch && matchInstance;
  });

  return (
    <div className="flex flex-col h-full bg-card/50">

      {/* Header */}
      <div className="px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground tracking-tight">Conversas</h2>
            {instances.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs rounded-full gap-1 px-2.5">
                    {selectedInstance || "Todas"}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onSelectInstance(null)} className={cn(!selectedInstance && "font-semibold")}>
                    Todas
                  </DropdownMenuItem>
                  {instances.map((inst) => (
                    <DropdownMenuItem key={inst.name} onClick={() => onSelectInstance(inst.name)} className={cn(selectedInstance === inst.name && "font-semibold")}>
                      {inst.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
            onClick={onSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-10 rounded-full bg-secondary/60 border-0 focus-visible:ring-1 focus-visible:ring-ring text-sm placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !filtered?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-3">
              <MessageSquare className="h-5 w-5 opacity-50" />
            </div>
            <span className="text-sm font-medium">Nenhuma conversa</span>
            <span className="text-xs mt-1 opacity-60">Sincronize para importar</span>
          </div>
        ) : (
          <div className="px-1.5 pb-2">
            {filtered.map((conv, index) => {
              const isSelected = selected?.id === conv.id;
              const hasUnread = conv.unread_count > 0;

              return (
                <ContextMenu key={conv.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => onSelect(conv)}
                      className={cn(
                        "w-full text-left px-3 py-3 transition-all duration-150 flex items-center gap-3 rounded-xl relative",
                        isSelected
                          ? "bg-primary/10 shadow-sm"
                          : "hover:bg-secondary/70"
                      )}
                    >
                      {/* Unread indicator dot */}
                      {hasUnread && (
                        <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
                      )}

                      <div className="relative">
                        <ContactAvatar
                          photoUrl={contactPhotos[conv.remote_jid]}
                          name={conv.contact_name}
                          size="md"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn(
                              "text-sm truncate",
                              hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                            )}>
                              {conv.contact_name || formatJid(conv.remote_jid)}
                            </span>
                            {conv.instance_name && (
                              <span className="shrink-0 text-[9px] font-medium text-muted-foreground/60 bg-secondary/80 px-1.5 py-0.5 rounded">
                                {conv.instance_name}
                              </span>
                            )}
                          </div>
                          <span className={cn(
                            "text-[10px] shrink-0 whitespace-nowrap",
                            hasUnread ? "text-primary font-semibold" : "text-muted-foreground"
                          )}>
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className={cn(
                            "text-xs truncate",
                            hasUnread ? "text-foreground/70 font-medium" : "text-muted-foreground"
                          )}>
                            {conv.last_message || "..."}
                          </p>
                          {hasUnread && (
                            <span className="flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                              {conv.unread_count > 99 ? "99+" : conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(conv)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir conversa
                    </ContextMenuItem>
                  </ContextMenuContent>
                  {/* Separator between items */}
                  {index < (filtered?.length || 0) - 1 && (
                    <div className="mx-3 border-b border-border/40" />
                  )}
                </ContextMenu>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
