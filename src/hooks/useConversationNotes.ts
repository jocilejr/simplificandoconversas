import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";

export interface ConversationNote {
  id: string;
  conversation_id: string;
  remote_jid: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function useConversationNotes(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation-notes", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conversation_notes")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ConversationNote[];
    },
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async ({ conversationId, remoteJid, content }: { conversationId: string; remoteJid: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !workspaceId) throw new Error("Workspace não selecionado");
      const { error } = await (supabase as any).from("conversation_notes").insert({
        conversation_id: conversationId,
        remote_jid: remoteJid,
        content,
        workspace_id: workspaceId,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["conversation-notes", vars.conversationId] });
      toast({ title: "Nota adicionada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, conversationId }: { id: string; conversationId: string }) => {
      const { error } = await (supabase as any).from("conversation_notes").delete().eq("id", id);
      if (error) throw error;
      return conversationId;
    },
    onSuccess: (conversationId) => {
      qc.invalidateQueries({ queryKey: ["conversation-notes", conversationId] });
      toast({ title: "Nota removida" });
    },
  });
}
