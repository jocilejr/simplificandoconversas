import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useState } from "react";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type EventPeriod = "today" | "yesterday" | "custom";

type GroupActionCounts = { add: number; remove: number; promote: number; demote: number };

const BRAZIL_TIMEZONE = "America/Sao_Paulo";
const emptyCounts: GroupActionCounts = { add: 0, remove: 0, promote: 0, demote: 0 };

function getBrazilNow(): Date {
  return toZonedTime(new Date(), BRAZIL_TIMEZONE);
}

function toBrazilUtcRange(date: Date) {
  const zonedDate = toZonedTime(date, BRAZIL_TIMEZONE);
  return {
    start: fromZonedTime(startOfDay(zonedDate), BRAZIL_TIMEZONE).toISOString(),
    end: fromZonedTime(endOfDay(zonedDate), BRAZIL_TIMEZONE).toISOString(),
  };
}

function getDateRange(period: EventPeriod, customRange?: { from: Date; to: Date }) {
  const now = getBrazilNow();
  if (period === "yesterday") {
    return toBrazilUtcRange(subDays(now, 1));
  }
  if (period === "custom" && customRange) {
    return {
      start: fromZonedTime(startOfDay(toZonedTime(customRange.from, BRAZIL_TIMEZONE)), BRAZIL_TIMEZONE).toISOString(),
      end: fromZonedTime(endOfDay(toZonedTime(customRange.to, BRAZIL_TIMEZONE)), BRAZIL_TIMEZONE).toISOString(),
    };
  }
  return toBrazilUtcRange(now);
}

function buildEventCounts(rows: Array<{ action: string | null }>) {
  const counts: GroupActionCounts = { ...emptyCounts };

  for (const row of rows) {
    const action = row.action as keyof GroupActionCounts;
    if (action in counts) counts[action]++;
  }

  return counts;
}

function buildGroupCounts(rows: Array<{ group_jid: string | null; action: string | null }>) {
  return rows.reduce<Record<string, GroupActionCounts>>((acc, row) => {
    if (!row.group_jid) return acc;

    if (!acc[row.group_jid]) {
      acc[row.group_jid] = { ...emptyCounts };
    }

    const action = row.action as keyof GroupActionCounts;
    if (action in acc[row.group_jid]) {
      acc[row.group_jid][action]++;
    }

    return acc;
  }, {});
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

  // Métricas reais do período completo, independentes do feed visual limitado
  const { data: metrics = { eventCounts: emptyCounts, groupCounts: {} as Record<string, GroupActionCounts> }, isLoading: isMetricsLoading } = useQuery({
    queryKey: ["group-event-metrics", workspaceId, start, end, monitoredJids],
    enabled: !!workspaceId && hasJids,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_participant_events")
        .select("group_jid, action")
        .eq("workspace_id", workspaceId!)
        .in("group_jid", monitoredJids)
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;

      return {
        eventCounts: buildEventCounts(data || []),
        groupCounts: buildGroupCounts(data || []),
      };
    },
  });

  return {
    events,
    eventCounts: metrics.eventCounts,
    groupCounts: metrics.groupCounts,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    isLoading: isLoading || isMetricsLoading,
  };
}
