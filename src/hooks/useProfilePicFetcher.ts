import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ChatConversation } from "@/hooks/useConversationsLive";

export function useProfilePicFetcher(conversations: ChatConversation[]) {
  const { workspaceId } = useWorkspace();
  const fetching = useRef(false);
  const lastFetch = useRef(0);
  const qc = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    const missing = conversations.filter((c) => !c.profile_pic_url && c.instance_name);
    if (missing.length === 0) return;
    // Don't re-fetch within 60s of last attempt
    if (fetching.current || Date.now() - lastFetch.current < 60_000) return;
    fetching.current = true;
    lastFetch.current = Date.now();

    supabase.functions.invoke("whatsapp-proxy", {
      body: { action: "fetch-missing-profile-pics", workspaceId },
    }).then(({ data }) => {
      if (!data?.map) return;
      const picMap: Record<string, string> = data.map;
      if (Object.keys(picMap).length === 0) return;
      qc.setQueriesData(
        { queryKey: ["chat-conversations", workspaceId] },
        (old: ChatConversation[] | undefined) =>
          (old || []).map((c) => (picMap[c.id] ? { ...c, profile_pic_url: picMap[c.id] } : c))
      );
    }).catch(() => {}).finally(() => {
      fetching.current = false;
    });
  }, [workspaceId, conversations.length]);
}
