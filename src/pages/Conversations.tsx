import { useState, useEffect, useMemo } from "react";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useContactPhotos } from "@/hooks/useContactPhoto";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ConversationList } from "@/components/conversations/ConversationList";
import { ChatPanel } from "@/components/conversations/ChatPanel";
import { RightPanel } from "@/components/conversations/RightPanel";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/hooks/useLabels";

const Conversations = () => {
  const queryClient = useQueryClient();
  const { data: conversations, isLoading: loadingConvs, markAsRead, deleteConversation } = useConversations();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const { data: messages, isLoading: loadingMsgs, sendMessage } = useMessages(selected?.id || null);
  const { toast } = useToast();
  const { instances } = useWhatsAppInstances();
  const { user } = useAuth();

  // Fetch all conversation labels with label details for the sidebar
  const { data: allConversationLabels } = useQuery({
    queryKey: ["all_conversation_labels"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_labels")
        .select("*, labels(*)");
      if (error) throw error;
      return data as ({ conversation_id: string; label_id: string; labels: Label })[];
    },
  });

  const conversationLabelsMap = useMemo(() => {
    const map: Record<string, Label[]> = {};
    (allConversationLabels || []).forEach((cl) => {
      if (!map[cl.conversation_id]) map[cl.conversation_id] = [];
      if (cl.labels) map[cl.conversation_id].push(cl.labels);
    });
    return map;
  }, [allConversationLabels]);

  const remoteJids = useMemo(
    () => (conversations || []).map((c) => c.remote_jid),
    [conversations]
  );
  const { data: contactPhotos } = useContactPhotos(remoteJids);

  const instanceTabs = useMemo(
    () => instances.map((i) => ({ name: i.instance_name, label: i.instance_name })),
    [instances]
  );

  const syncChats = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "sync-chats" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (data?.info) {
        toast({ title: "Informação", description: data.info });
      } else if (data?.synced > 0) {
        toast({ title: "Sincronizado", description: `${data.synced} conversas sincronizadas` });
      } else {
        const statuses = data?.instanceStatuses || [];
        const disconnected = statuses.filter((s: any) => s.connectionState !== "open");
        if (statuses.length === 0) {
          toast({ title: "Nenhuma instância", description: "Conecte uma instância em Configurações.", variant: "destructive" });
        } else if (disconnected.length === statuses.length) {
          toast({ title: "Instâncias desconectadas", description: "Reconecte via QR Code em Configurações.", variant: "destructive" });
        } else {
          toast({ title: "Sincronizado", description: "0 conversas encontradas nas instâncias conectadas" });
        }
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (selected && selected.unread_count > 0) {
      markAsRead(selected.id);
    }
  }, [selected]);

  const handleSend = async (msg: string) => {
    if (!selected) return;
    try {
      await sendMessage.mutateAsync({
        remoteJid: selected.remote_jid,
        message: msg,
      });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (conv: Conversation) => {
    try {
      if (selected?.id === conv.id) setSelected(null);
      await deleteConversation(conv.id);
      toast({ title: "Conversa excluída" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="h-full flex">
      {/* Left - Conversation List */}
      <div className="w-80 lg:w-96 shrink-0 border-r border-border">
        <ConversationList
          conversations={conversations}
          isLoading={loadingConvs}
          selected={selected}
          onSelect={(conv) => { setSelected(conv); }}
          onSync={() => syncChats.mutate()}
          onDelete={handleDelete}
          isSyncing={syncChats.isPending}
          contactPhotos={contactPhotos || {}}
          instances={instanceTabs}
          selectedInstance={selectedInstance}
          onSelectInstance={setSelectedInstance}
          conversationLabels={conversationLabelsMap}
        />
      </div>

      {/* Center - Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatPanel
          conversation={selected}
          messages={messages}
          isLoading={loadingMsgs}
          onSend={handleSend}
          isSending={sendMessage.isPending}
          contactPhoto={selected ? (contactPhotos || {})[selected.remote_jid] : null}
          onToggleRightPanel={() => setShowRightPanel(p => !p)}
          showRightPanel={showRightPanel}
        />
      </div>

      {/* Right - Details Panel */}
      {showRightPanel && selected && (
        <RightPanel
          conversation={selected}
          contactPhoto={(contactPhotos || {})[selected.remote_jid]}
          onClose={() => setShowRightPanel(false)}
        />
      )}
    </div>
  );
};

export default Conversations;
