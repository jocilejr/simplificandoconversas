import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";
import { useEffect, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";

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
    refetchInterval: 3_000,
  });

  const counts = query.data || { aprovados: 0, "boletos-gerados": 0, "pix-cartao-pendentes": 0, rejeitados: 0 };
  const originalTitle = useRef(document.title);

  // Dynamic document.title
  useEffect(() => {
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    if (total > 0) {
      document.title = `(${total}) Nova transação! | Simplificando`;
    } else {
      document.title = originalTitle.current;
    }
    return () => {
      document.title = originalTitle.current;
    };
  }, [counts]);

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
      if (!ids.length || !workspaceId) return;
      try {
        const resp = await fetch(apiUrl("platform/mark-seen"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, workspaceId }),
        });
        const result = await resp.json();
        if (result.error) {
          console.error("[markSeen] backend error:", result.error);
          return;
        }
        console.log("[markSeen] updated:", result.updated);
        queryClient.invalidateQueries({ queryKey: ["unseen-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      } catch (err) {
        console.error("[markSeen] fetch error:", err);
      }
    },
    [workspaceId, queryClient]
  );

  const markTabSeen = useCallback(
    async (tab: TabKey) => {
      if (!workspaceId) return;
      try {
        const resp = await fetch(apiUrl("platform/mark-tab-seen"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, tab }),
        });
        const result = await resp.json();
        if (result.error) {
          console.error("[markTabSeen] backend error:", result.error);
          return;
        }
        console.log("[markTabSeen] updated:", result.updated, "tab:", tab);
        queryClient.invalidateQueries({ queryKey: ["unseen-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      } catch (err) {
        console.error("[markTabSeen] fetch error:", err);
      }
    },
    [workspaceId, queryClient]
  );

  const markAllSeen = useCallback(
    async () => {
      if (!workspaceId) return;
      try {
        const resp = await fetch(apiUrl("platform/mark-all-seen"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        });
        const result = await resp.json();
        if (result.error) {
          console.error("[markAllSeen] backend error:", result.error);
          return;
        }
        if (result.updated > 0) {
          console.log("[markAllSeen] updated:", result.updated);
        }
        queryClient.invalidateQueries({ queryKey: ["unseen-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      } catch (err) {
        console.error("[markAllSeen] fetch error:", err);
      }
    },
    [workspaceId, queryClient]
  );

  return { hasUnseen, hasAnyUnseen, markSeen, markTabSeen, markAllSeen, counts };
}
