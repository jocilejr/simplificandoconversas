import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";

export interface QueueItem {
  group_jid: string;
  group_name: string;
  status: string;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface ScheduledMessageDebug {
  id: string;
  schedule_type: string;
  message_type: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  effective_run_at: string | null;
  has_timer: boolean;
  missed: boolean;
  campaign_name: string;
  content_preview: string;
  content: {
    text?: string;
    caption?: string;
    mediaUrl?: string;
    audioUrl?: string;
    fileName?: string;
    mentionAll?: boolean;
    forceLinkPreview?: boolean;
    [key: string]: any;
  };
  queue_items: QueueItem[];
}

export interface SchedulerDebugData {
  timers_active: number;
  server_time_utc: string;
  server_time_brt: string;
  groups_count: number;
  messages: ScheduledMessageDebug[];
}

export function useSchedulerDebug() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<SchedulerDebugData>({
    queryKey: ["scheduler-debug", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const resp = await fetch(apiUrl(`groups/scheduler-debug?workspaceId=${workspaceId}`));
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["scheduler-debug", workspaceId] });

  return { data, isLoading, error, refresh };
}
