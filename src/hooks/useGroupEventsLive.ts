import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";
import type { EventPeriod } from "@/hooks/useGroupEvents";

export type LiveGroupEvent = {
  id: string;
  group_jid: string;
  group_name: string;
  participant_jid: string;
  action: "add" | "remove";
  occurred_at: string;
};

type LiveResponse = {
  window: { startUtc: string; endUtc: string };
  events: LiveGroupEvent[];
};

const empty: LiveResponse = { window: { startUtc: "", endUtc: "" }, events: [] };

function buildParams(
  workspaceId: string,
  period: EventPeriod,
  customRange?: { from: Date; to: Date },
  limit = 200
) {
  const params = new URLSearchParams({ workspaceId, period, limit: String(limit) });
  if (period === "custom" && customRange) {
    const fmt = (d: Date) => {
      const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      return brt.toISOString().slice(0, 10);
    };
    params.set("from", fmt(customRange.from));
    params.set("to", fmt(customRange.to));
  }
  return params.toString();
}

/**
 * Eventos crus (add/remove) em ordem cronológica reversa para o modal "tempo real".
 * Só faz fetch quando `enabled` é true (modal aberto). Refetch a cada 15s.
 */
export function useGroupEventsLive(
  period: EventPeriod,
  customRange: { from: Date; to: Date } | undefined,
  enabled: boolean
) {
  const { workspaceId } = useWorkspace();
  const qs = workspaceId ? buildParams(workspaceId, period, customRange) : "";

  const { data = empty, isLoading } = useQuery({
    queryKey: [
      "group-events-live",
      workspaceId,
      period,
      customRange?.from?.toISOString(),
      customRange?.to?.toISOString(),
    ],
    enabled: !!workspaceId && enabled,
    refetchInterval: enabled ? 15000 : false,
    queryFn: async (): Promise<LiveResponse> => {
      const resp = await fetch(`${apiUrl("groups/events-live")}?${qs}`);
      if (!resp.ok) throw new Error((await resp.text()) || "Erro ao carregar eventos ao vivo");
      const json = await resp.json();
      return {
        window: json.window || { startUtc: "", endUtc: "" },
        events: Array.isArray(json.events) ? json.events : [],
      };
    },
  });

  return { events: data.events, window: data.window, isLoading };
}
