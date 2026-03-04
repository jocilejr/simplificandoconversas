import { useState, useEffect, useMemo } from "react";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useContactPhotos } from "@/hooks/useContactPhoto";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConversationList } from "@/components/conversations/ConversationList";
import { ChatPanel } from "@/components/conversations/ChatPanel";

const Conversations = () => {
  const queryClient = useQueryClient();
  const { data: conversations, isLoading: loadingConvs, markAsRead } = useConversations();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const { data: messages, isLoading: loadingMsgs, sendMessage } = useMessages(selected?.id || null);
  const { toast } = useToast();

  const remoteJids = useMemo(
    () => (conversations || []).map((c) => c.remote_jid),
    [conversations]
  );
  const { data: contactPhotos } = useContactPhotos(remoteJids);

  const syncChats = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "sync-chats" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (data?.info) {
        toast({ title: "Informação", description: data.info });
      } else {
        toast({ title: "Sincronizado", description: `${data?.synced || 0} conversas sincronizadas` });
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

  return (
    <div className="h-[calc(100vh-4rem)] flex rounded-xl overflow-hidden border border-border shadow-sm">
      {/* Left panel */}
      <div className="w-80 lg:w-96 shrink-0">
        <ConversationList
          conversations={conversations}
          isLoading={loadingConvs}
          selected={selected}
          onSelect={setSelected}
          onSync={() => syncChats.mutate()}
          isSyncing={syncChats.isPending}
          contactPhotos={contactPhotos || {}}
        />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col">
        <ChatPanel
          conversation={selected}
          messages={messages}
          isLoading={loadingMsgs}
          onSend={handleSend}
          isSending={sendMessage.isPending}
          contactPhoto={selected ? (contactPhotos || {})[selected.remote_jid] : null}
        />
      </div>
    </div>
  );
};

export default Conversations;
