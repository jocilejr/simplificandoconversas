import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface Transaction {
  id: string;
  user_id: string;
  external_id: string | null;
  source: string;
  type: string;
  status: string;
  amount: number;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  created_at: string;
  paid_at: string | null;
  metadata: any;
}

interface UseTransactionsOptions {
  startDate: Date;
  endDate: Date;
}

export function useTransactions({ startDate, endDate }: UseTransactionsOptions) {
  const query = useQuery({
    queryKey: ["transactions", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });

  const stats = useMemo(() => {
    const txns = query.data || [];
    const totalReceived = txns.filter(t => t.status === "pago").reduce((s, t) => s + Number(t.amount), 0);
    const totalPending = txns.filter(t => t.status === "pendente").reduce((s, t) => s + Number(t.amount), 0);
    const countByStatus: Record<string, number> = {};
    const countBySource: Record<string, number> = {};
    const countByType: Record<string, number> = {};
    txns.forEach(t => {
      countByStatus[t.status] = (countByStatus[t.status] || 0) + 1;
      countBySource[t.source] = (countBySource[t.source] || 0) + 1;
      countByType[t.type] = (countByType[t.type] || 0) + 1;
    });
    return { totalReceived, totalPending, countByStatus, countBySource, countByType, total: txns.length };
  }, [query.data]);

  return { ...query, stats };
}
