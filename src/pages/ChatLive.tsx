import { useEffect, useMemo, useState } from "react";
import { useConversationsLive, ChatConversation, markConversationRead } from "@/hooks/useConversationsLive";
import { useMessagesLive } from "@/hooks/useMessagesLive";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useLabels } from "@/hooks/useLabels";
import { ConversationList } from "@/components/chat/ConversationList";
import { MessageThread } from "@/components/chat/MessageThread";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { ContactPanel } from "@/components/chat/ContactPanel";
import { MessageCircle } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function ChatLive() {
  const { instances = [] } = useWhatsAppInstances();
  const { data: labels = [] } = useLabels();
  const { canWrite } = useWorkspace();

  const [instanceFilter, setInstanceFilter] = useState<string>("__all__");
  const [labelFilter, setLabelFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ChatConversation | null>(null);

  const { data: conversations = [], isLoading } = useConversationsLive({
    instanceName: instanceFilter === "__all__" ? null : instanceFilter,
    labelId: labelFilter === "__all__" ? null : labelFilter,
    search,
  });

  // Keep the selected conversation in sync with the latest data (for unread_count updates)
  const selectedLive = useMemo(
    () => (selected ? conversations.find((c) => c.id === selected.id) || selected : null),
    [selected, conversations]
  );

  const { data: messages = [], isLoading: loadingMessages } = useMessagesLive(
    selectedLive?.id ?? null
  );

  // Mark as read when opening a conversation with unread > 0
  useEffect(() => {
    if (selectedLive && selectedLive.unread_count > 0) {
      markConversationRead(selectedLive.id).catch(() => {});
    }
  }, [selectedLive?.id]);

  const contactName = selectedLive?.contact_name || selectedLive?.phone_number || selectedLive?.remote_jid || "";

  const handleSelectFromPanel = (conversationId: string) => {
    const found = conversations.find((c) => c.id === conversationId);
    if (found) setSelected(found);
  };

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/30">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Chat ao Vivo</h1>
        <span className="text-[11px] text-muted-foreground ml-2">
          {conversations.length} conversa{conversations.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[340px_1fr_320px] overflow-hidden">
        <ConversationList
          conversations={conversations}
          loading={isLoading}
          selectedId={selectedLive?.id ?? null}
          onSelect={(c) => setSelected(c)}
          instances={instances}
          instanceFilter={instanceFilter}
          onInstanceFilterChange={setInstanceFilter}
          labels={labels}
          labelFilter={labelFilter}
          onLabelFilterChange={setLabelFilter}
          search={search}
          onSearchChange={setSearch}
        />

        <div className="flex flex-col overflow-hidden bg-background">
          {selectedLive ? (
            <>
              <div className="px-4 py-2.5 border-b border-border bg-card/30 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                  {contactName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate leading-tight">{contactName}</p>
                  {selectedLive.instance_name && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      via {selectedLive.instance_name}
                    </p>
                  )}
                </div>
              </div>
              <MessageThread
                messages={messages}
                loading={loadingMessages}
                contactName={contactName}
              />
              <MessageComposer
                remoteJid={selectedLive.remote_jid}
                instanceName={selectedLive.instance_name || ""}
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

        <div className="hidden md:block overflow-hidden">
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
