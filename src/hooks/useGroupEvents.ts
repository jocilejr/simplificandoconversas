import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";

export type EventPeriod = "today" | "yesterday" | "custom";

export type GroupEventRow = {
  group_jid: string;
  group_name: string;
  adds: number;
  removes: number;
};

type Totals = { adds: number; removes: number };
type EventsResponse = {
  window: { startUtc: string; endUtc: string };
  totals: Totals;
  groups: GroupEventRow[];
};

const emptyResponse: EventsResponse = {
  window: { startUtc: "", endUtc: "" },
  totals: { adds: 0, removes: 0 },
  groups: [],
};

function buildParams(workspaceId: string, period: EventPeriod, customRange?: { from: Date; to: Date }) {
  const params = new URLSearchParams({ workspaceId, period });
  if (period === "custom" && customRange) {
    const fmt = (d: Date) => {
      // Envia data civil em BRT (UTC-3)
      const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      return brt.toISOString().slice(0, 10);
    };
    params.set("from", fmt(customRange.from));
    params.set("to", fmt(customRange.to));
  }
  return params.toString();
}

/**
 * Dumb client: 1 chamada, retorna `totals` + `groups[]`.
 * Toda lógica de janela e agregação vive no backend (SQL bruto via pg).
 */
export function useGroupEvents() {
  const { workspaceId } = useWorkspace();
  const [period, setPeriod] = useState<EventPeriod>("today");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();

  const queryString = workspaceId ? buildParams(workspaceId, period, customRange) : "";

  const { data = emptyResponse, isLoading } = useQuery({
    queryKey: ["group-events", workspaceId, period, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    enabled: !!workspaceId,
    refetchInterval: 15000,
    queryFn: async (): Promise<EventsResponse> => {
      const resp = await fetch(`${apiUrl("groups/events")}?${queryString}`);
      if (!resp.ok) throw new Error((await resp.text()) || "Erro ao carregar eventos");
      const json = await resp.json();
      return {
        window: json.window || { startUtc: "", endUtc: "" },
        totals: json.totals || { adds: 0, removes: 0 },
        groups: Array.isArray(json.groups) ? json.groups : [],
      };
    },
  });

  return {
    totals: data.totals,
    groups: data.groups,
    window: data.window,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    isLoading,
  };
}
