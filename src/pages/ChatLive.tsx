import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConversationsLive, ChatConversation, markConversationRead } from "@/hooks/useConversationsLive";
import { useMessagesLive } from "@/hooks/useMessagesLive";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useLabels } from "@/hooks/useLabels";
import { ConversationList } from "@/components/chat/ConversationList";
import { MessageThread } from "@/components/chat/MessageThread";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { ContactPanel } from "@/components/chat/ContactPanel";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useActiveFlowExecution, statusLabel } from "@/hooks/useActiveFlowExecution";
import { useProfilePicFetcher } from "@/hooks/useProfilePicFetcher";
import { cn } from "@/lib/utils";

export default function ChatLive() {
  const { instances = [] } = useWhatsAppInstances();
  const { data: labels = [] } = useLabels();
  const { canWrite, workspaceId } = useWorkspace();
  const qc = useQueryClient();

  const [instanceFilter, setInstanceFilter] = useState<string[]>([]);
  const [labelFilter, setLabelFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [convLimit, setConvLimit] = useState(500);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: conversations = [], isLoading } = useConversationsLive({
    instanceNames: instanceFilter,
    labelId: labelFilter === "__all__" ? null : labelFilter,
    search: debouncedSearch,
    limit: convLimit,
  });

  useProfilePicFetcher(conversations);

  const selectedLive = useMemo(
    () => (selected ? conversations.find((c) => c.id === selected.id) || selected : null),
    [selected, conversations]
  );

  const { data: messages = [], isLoading: loadingMessages } = useMessagesLive(
    selectedLive?.id ?? null
  );

  useEffect(() => {
    if (!selectedLive || selectedLive.unread_count === 0) return;
    // Optimistic: clear badge immediately
    qc.setQueriesData(
      { queryKey: ["chat-conversations", workspaceId] },
      (old: ChatConversation[] | undefined) => {
        if (!old) return old;
        return old.map((c) => (c.id === selectedLive.id ? { ...c, unread_count: 0 } : c));
      }
    );
    markConversationRead(selectedLive.id).catch(() => {});
  }, [selectedLive?.id, selectedLive?.unread_count]);

  const contactName = selectedLive?.contact_name || selectedLive?.phone_number || selectedLive?.remote_jid || "";
  const { data: activeFlow } = useActiveFlowExecution(selectedLive?.remote_jid ?? null);

  const handleSelect = (c: ChatConversation) => {
    setSelected(c);
    setMobileShowThread(true);
  };

  const handleSelectFromPanel = async (conversationId: string) => {
    const found = conversations.find((c) => c.id === conversationId);
    if (found) {
      setSelected(found);
      setMobileShowThread(true);
      return;
    }
    try {
      const { data } = await (supabase as any)
        .from("conversations")
        .select("id, remote_jid, instance_name, contact_name, phone_number, last_message, last_message_at, unread_count")
        .eq("id", conversationId)
        .maybeSingle();
      if (data) {
        setInstanceFilter([]);
        setSelected(data as ChatConversation);
        setMobileShowThread(true);
      }
    } catch (e: any) {
      console.error("[ChatLive] handleSelectFromPanel error:", e.message);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden min-h-0">

      <div className="flex-1 overflow-hidden flex flex-col md:grid md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr_320px]">
        {/* Lista de conversas */}
        <div className={cn(
          "overflow-hidden flex flex-col",
          mobileShowThread ? "hidden md:flex" : "flex-1 min-h-0 md:flex-none"
        )}>
          <ConversationList
            conversations={conversations}
            loading={isLoading}
            selectedId={selectedLive?.id ?? null}
            onSelect={handleSelect}
            instances={instances}
            instanceFilter={instanceFilter}
            onInstanceFilterChange={setInstanceFilter}
            labels={labels}
            labelFilter={labelFilter}
            onLabelFilterChange={setLabelFilter}
            search={search}
            onSearchChange={setSearch}
            hasMore={conversations.length === convLimit}
            onLoadMore={() => setConvLimit(function(p) { return p + 100; })}
          />
        </div>

        {/* Thread + Composer */}
        <div className={cn(
          "flex flex-col overflow-hidden bg-background",
          mobileShowThread ? "flex-1 min-h-0 md:flex-none" : "hidden md:flex"
        )}>
          {selectedLive ? (
            <>
              <div className="px-4 py-2.5 border-b border-border bg-card/30 flex items-center gap-2">
                <button
                  onClick={() => setMobileShowThread(false)}
                  className="md:hidden shrink-0 -ml-1 p-1 rounded hover:bg-accent touch-manipulation"
                  aria-label="Voltar para lista"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="h-9 w-9 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0 overflow-hidden">
                  {selectedLive.profile_pic_url ? (
                    <img src={selectedLive.profile_pic_url} alt={contactName} className="h-full w-full object-cover" />
                  ) : (
                    contactName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate leading-tight">{contactName}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {selectedLive.instance_name && (
                      <span className="text-[10px] text-muted-foreground truncate">via {selectedLive.instance_name}</span>
                    )}
                    {activeFlow && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                        <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span></span>
                        {statusLabel(activeFlow.status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <MessageThread
                messages={messages}
                loading={loadingMessages}
                contactName={contactName}
                conversationId={selectedLive?.id}
              />
              <MessageComposer
                remoteJid={selectedLive.remote_jid}
                instanceName={selectedLive.instance_name || ""}
                conversationId={selectedLive.id}
                disabled={!canWrite || !selectedLive.instance_name}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MessageCircle className="h-12 w-12 opacity-30" />
              <p className="text-sm">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>

        {/* Painel de contato (lg+) */}
        <div className="hidden lg:flex flex-col overflow-hidden">
          {selectedLive && (
            <ContactPanel
              conversation={selectedLive}
              onSelectConversation={handleSelectFromPanel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
