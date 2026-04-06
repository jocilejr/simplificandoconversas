import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEffect, useMemo, useState } from "react";

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
}

export function useTransactions(startDate?: Date, endDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions", user?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (startDate) {
        q = q.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        q = q.lte("created_at", endDate.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: !!user,
  });

  // Realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("transactions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const stats = useMemo(() => {
    const txs = query.data || [];
    const total = txs.length;
    const totalAmount = txs.reduce((s, t) => s + Number(t.amount), 0);
    const approved = txs.filter((t) => t.status === "aprovado");
    const approvedAmount = approved.reduce((s, t) => s + Number(t.amount), 0);
    const pending = txs.filter((t) => t.status === "pendente");
    const pendingAmount = pending.reduce((s, t) => s + Number(t.amount), 0);
    const rejected = txs.filter((t) => ["rejeitado", "cancelado", "estornado"].includes(t.status));
    const rejectedAmount = rejected.reduce((s, t) => s + Number(t.amount), 0);

    return {
      total,
      totalAmount,
      approvedCount: approved.length,
      approvedAmount,
      pendingCount: pending.length,
      pendingAmount,
      rejectedCount: rejected.length,
      rejectedAmount,
    };
  }, [query.data]);

  return { ...query, stats };
}
