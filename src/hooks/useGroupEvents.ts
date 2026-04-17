import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useState } from "react";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { apiUrl } from "@/lib/api";

export type EventPeriod = "today" | "yesterday" | "custom";

type GroupActionCounts = { add: number; remove: number; promote: number; demote: number };

const BRAZIL_TIMEZONE = "America/Sao_Paulo";
const emptyCounts: GroupActionCounts = { add: 0, remove: 0, promote: 0, demote: 0 };
const EVENTS_PAGE_SIZE = 1000;

const isLovablePreview = (import.meta.env.VITE_SUPABASE_URL || "").includes(".supabase.co");

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

/** Lovable preview: query Supabase directly with strict (instance_name, group_jid) filter. */
async function fetchAllGroupEventsSupabase(workspaceId: string, start: string, end: string) {
  // 1) Get monitored tuples
  const { data: monitored, error: monErr } = await supabase
    .from("group_selected")
    .select("instance_name, group_jid")
    .eq("workspace_id", workspaceId);
  if (monErr) throw monErr;
  if (!monitored || monitored.length === 0) return [];

  const allowed = new Set(monitored.map((m: any) => `${m.instance_name}::${m.group_jid}`));
  const groupJids = [...new Set(monitored.map((m: any) => m.group_jid))];

  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const to = from + EVENTS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("group_participant_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("group_jid", groupJids)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    const batch = data || [];
    allRows.push(...batch);
    if (batch.length < EVENTS_PAGE_SIZE) break;
    from += EVENTS_PAGE_SIZE;
  }

  // Final strict filter by (instance_name, group_jid)
  return allRows.filter((e: any) => allowed.has(`${e.instance_name}::${e.group_jid}`));
}

async function fetchAllGroupEventsVPS(workspaceId: string, start: string, end: string) {
  const params = new URLSearchParams({ workspaceId, start, end });
  const resp = await fetch(`${apiUrl("groups/events")}?${params}`);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "Erro ao carregar eventos de grupo");
  }
  return resp.json();
}

export function useGroupEvents() {
  const { workspaceId } = useWorkspace();
  const [period, setPeriod] = useState<EventPeriod>("today");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();

  const { start, end } = getDateRange(period, customRange);

  const { data: metrics = { events: [], eventCounts: emptyCounts, groupCounts: {} as Record<string, GroupActionCounts> }, isLoading } = useQuery({
    queryKey: ["group-events", workspaceId, start, end],
    enabled: !!workspaceId,
    refetchInterval: 15000,
    queryFn: async () => {
      const data = isLovablePreview
        ? await fetchAllGroupEventsSupabase(workspaceId!, start, end)
        : await fetchAllGroupEventsVPS(workspaceId!, start, end);

      return {
        events: data,
        eventCounts: buildEventCounts(data || []),
        groupCounts: buildGroupCounts(data || []),
      };
    },
  });

  return {
    events: metrics.events,
    // eventCounts/groupCounts ficam disponíveis como fallback, mas o dashboard
    // deve preferir useGroupStatsSummary (COUNT direto no banco).
    eventCounts: metrics.eventCounts,
    groupCounts: metrics.groupCounts,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    start,
    end,
    isLoading,
  };
}
