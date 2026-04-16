import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useState } from "react";
import { startOfDay, endOfDay, subDays } from "date-fns";

export type EventPeriod = "today" | "yesterday" | "custom";

function getBrazilNow(): Date {
  const brazilDateStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brazilDateStr);
}

function getDateRange(period: EventPeriod, customRange?: { from: Date; to: Date }) {
  const now = getBrazilNow();
  if (period === "yesterday") {
    const y = subDays(now, 1);
    return { start: startOfDay(y).toISOString(), end: endOfDay(y).toISOString() };
  }
  if (period === "custom" && customRange) {
    return { start: startOfDay(customRange.from).toISOString(), end: endOfDay(customRange.to).toISOString() };
  }
  return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() };
}

export function useGroupEvents(monitoredJids: string[] = []) {
  const { workspaceId } = useWorkspace();
  const [period, setPeriod] = useState<EventPeriod>("today");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();

  const { start, end } = getDateRange(period, customRange);

  const hasJids = monitoredJids.length > 0;

  // Feed: eventos filtrados por data e grupos monitorados
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["group-events", workspaceId, start, end, monitoredJids],
    enabled: !!workspaceId && hasJids,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_participant_events")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .in("group_jid", monitoredJids)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Contadores filtrados por data e grupos monitorados
  const { data: eventCounts = { add: 0, remove: 0, promote: 0, demote: 0 } } = useQuery({
    queryKey: ["group-event-counts", workspaceId, start, end, monitoredJids],
    enabled: !!workspaceId && hasJids,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_participant_events")
        .select("action")
        .eq("workspace_id", workspaceId!)
        .in("group_jid", monitoredJids)
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;

      const counts = { add: 0, remove: 0, promote: 0, demote: 0 };
      for (const row of data || []) {
        const action = row.action as keyof typeof counts;
        if (action in counts) counts[action]++;
      }
      return counts;
    },
  });

  return { events, eventCounts, period, setPeriod, customRange, setCustomRange, isLoading };
}
