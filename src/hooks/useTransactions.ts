import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";
import { useEffect, useMemo } from "react";

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  status: string;
  source: string;
  external_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  description: string | null;
  payment_url: string | null;
  metadata: any;
  paid_at: string | null;
  created_at: string;
  whatsapp_valid: boolean | null;
  viewed_at: string | null;
}

export function useTransactions(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  // Query 1: transactions by created_at range
  const createdQuery = useQuery({
    queryKey: ["transactions", workspaceId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });

      if (startDate) q = q.gte("created_at", startDate.toISOString());
      if (endDate) q = q.lte("created_at", endDate.toISOString());

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: !!user && !!workspaceId,
  });

  // Query 2: approved transactions by paid_at range (captures old boletos paid today)
  const paidQuery = useQuery({
    queryKey: ["transactions-paid", workspaceId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!startDate || !endDate) return [] as Transaction[];

      let q = supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("status", "aprovado")
        .gte("paid_at", startDate.toISOString())
        .lte("paid_at", endDate.toISOString())
        .order("paid_at", { ascending: false });

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: !!user && !!workspaceId && !!startDate && !!endDate,
  });

  // Merge + dedup by id
  const mergedData = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const t of createdQuery.data || []) map.set(t.id, t);
    for (const t of paidQuery.data || []) map.set(t.id, t);
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [createdQuery.data, paidQuery.data]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("transactions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["transactions-paid"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const stats = useMemo(() => {
    const txs = mergedData;
    const total = txs.length;
    const totalAmount = txs.reduce((s, t) => s + Number(t.amount), 0);
    const paid = txs.filter((t) => t.status === "aprovado");
    const paidAmount = paid.reduce((s, t) => s + Number(t.amount), 0);
    const pending = txs.filter((t) => t.status === "pendente");
    const pendingAmount = pending.reduce((s, t) => s + Number(t.amount), 0);

    return {
      total,
      totalAmount,
      paidCount: paid.length,
      paidAmount,
      pendingCount: pending.length,
      pendingAmount,
    };
  }, [mergedData]);

  return {
    data: mergedData,
    isLoading: createdQuery.isLoading || paidQuery.isLoading,
    error: createdQuery.error || paidQuery.error,
    stats,
  };
}
