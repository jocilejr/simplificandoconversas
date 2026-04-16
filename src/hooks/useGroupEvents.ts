import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useState } from "react";

export type EventPeriod = "today" | "7d" | "30d";

function getPeriodStart(period: EventPeriod): string {
  const now = new Date();
  if (period === "today") {
    // Start of today BRT (UTC-3)
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const startBrt = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 3, 0, 0));
    if (startBrt > now) startBrt.setDate(startBrt.getDate() - 1);
    return startBrt.toISOString();
  }
  if (period === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export function useGroupEvents() {
  const { workspaceId } = useWorkspace();
  const [period, setPeriod] = useState<EventPeriod>("today");

  // Feed: últimos 50 eventos para exibição
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["group-events", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_participant_events")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Contadores estáveis via agregação no banco
  const { data: eventCounts = { add: 0, remove: 0, promote: 0, demote: 0 } } = useQuery({
    queryKey: ["group-event-counts", workspaceId, period],
    enabled: !!workspaceId,
    refetchInterval: 15000,
    queryFn: async () => {
      const periodStart = getPeriodStart(period);
      const { data, error } = await supabase
        .from("group_participant_events")
        .select("action")
        .eq("workspace_id", workspaceId!)
        .gte("created_at", periodStart);
      if (error) throw error;

      const counts = { add: 0, remove: 0, promote: 0, demote: 0 };
      for (const row of data || []) {
        const action = row.action as keyof typeof counts;
        if (action in counts) counts[action]++;
      }
      return counts;
    },
  });

  return { events, eventCounts, period, setPeriod, isLoading };
}
