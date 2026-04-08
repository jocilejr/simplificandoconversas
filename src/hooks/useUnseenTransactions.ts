import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";
import { useEffect, useCallback } from "react";

type TabKey = "aprovados" | "boletos-gerados" | "pix-cartao-pendentes" | "rejeitados";

interface UnseenCounts {
  aprovados: number;
  "boletos-gerados": number;
  "pix-cartao-pendentes": number;
  rejeitados: number;
}

export function useUnseenTransactions() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["unseen-transactions", workspaceId],
    queryFn: async (): Promise<UnseenCounts> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, status, viewed_at")
        .eq("workspace_id", workspaceId!)
        .is("viewed_at", null);

      if (error) throw error;
      const rows = data || [];

      return {
        aprovados: rows.filter((t) => t.status === "aprovado").length,
        "boletos-gerados": rows.filter((t) => t.type === "boleto" && t.status === "pendente").length,
        "pix-cartao-pendentes": rows.filter(
          (t) => (t.type === "pix" || t.type === "cartao" || t.type === "card") && t.status === "pendente"
        ).length,
        rejeitados: rows.filter(
          (t) => (t.type === "yampi_cart" && t.status === "abandonado") || t.status === "rejeitado"
        ).length,
      };
    },
    enabled: !!user && !!workspaceId,
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user || !workspaceId) return;

    const channel = supabase
      .channel("unseen-tx-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unseen-transactions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, workspaceId, queryClient]);

  const counts = query.data || { aprovados: 0, "boletos-gerados": 0, "pix-cartao-pendentes": 0, rejeitados: 0 };

  const hasUnseen = useCallback(
    (tab: TabKey) => counts[tab] > 0,
    [counts]
  );

  const hasAnyUnseen = useCallback(
    () => Object.values(counts).some((c) => c > 0),
    [counts]
  );

  const markSeen = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from("transactions")
        .update({ viewed_at: new Date().toISOString() } as any)
        .in("id", ids)
        .is("viewed_at", null);

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["unseen-transactions"] });
      }
    },
    [queryClient]
  );

  return { hasUnseen, hasAnyUnseen, markSeen, counts };
}
