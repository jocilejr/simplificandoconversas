import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";

export interface TransactionNotification {
  id: string;
  type: string;
  status: string;
  customerName: string;
  amount: number;
  timestamp: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getNotificationInfo(type: string, status: string): { icon: string; title: string } | null {
  if (type === "boleto" && status === "pendente") return { icon: "📄", title: "Novo boleto gerado" };
  if (type === "boleto" && status === "aprovado") return { icon: "✅", title: "Boleto pago!" };
  if (type === "boleto" && status === "rejeitado") return { icon: "❌", title: "Boleto falhou" };
  if (type === "pix" && status === "pendente") return { icon: "💠", title: "PIX gerado" };
  if (type === "pix" && status === "aprovado") return { icon: "✅", title: "PIX recebido!" };
  if ((type === "cartao" || type === "card") && status === "pendente") return { icon: "💳", title: "Cartão gerado" };
  if ((type === "cartao" || type === "card") && status === "aprovado") return { icon: "✅", title: "Cartão aprovado!" };
  if ((type === "cartao" || type === "card") && status === "rejeitado") return { icon: "❌", title: "Cartão recusado" };
  if (type === "yampi_cart" && status === "abandonado") return { icon: "🛒", title: "Carrinho abandonado" };
  return null;
}

export function useTransactionNotifications() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [notifications, setNotifications] = useState<TransactionNotification[]>([]);
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const permissionAsked = useRef(false);
  const originalTitle = useRef(document.title);

  // Request browser notification permission once
  useEffect(() => {
    if (permissionAsked.current) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      permissionAsked.current = true;
      Notification.requestPermission();
    }
  }, []);

  // Poll for recent unseen transactions
  const { data: recentTx } = useQuery({
    queryKey: ["tx-notifications-poll", workspaceId],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, status, customer_name, amount, created_at")
        .eq("workspace_id", workspaceId!)
        .gte("created_at", since)
        .is("viewed_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!workspaceId,
    refetchInterval: 15_000,
  });

  // Detect new transactions and create notifications
  useEffect(() => {
    if (!recentTx) return;

    if (!initialized.current) {
      // First load: seed known IDs without firing notifications
      for (const tx of recentTx) {
        knownIds.current.add(tx.id);
      }
      initialized.current = true;
      return;
    }

    const newTxs = recentTx.filter((tx) => !knownIds.current.has(tx.id));
    if (newTxs.length === 0) return;

    const newNotifications: TransactionNotification[] = [];

    for (const tx of newTxs) {
      knownIds.current.add(tx.id);
      const info = getNotificationInfo(tx.type, tx.status);
      if (!info) continue;

      newNotifications.push({
        id: tx.id,
        type: tx.type,
        status: tx.status,
        customerName: tx.customer_name || "Cliente",
        amount: Number(tx.amount),
        timestamp: new Date(tx.created_at),
      });

      // Browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        const name = tx.customer_name || "Cliente";
        const amount = tx.amount ? formatCurrency(Number(tx.amount)) : "";
        const body = amount ? `${name} — ${amount}` : name;
        new Notification(`${info.icon} ${info.title}`, { body, tag: `tx-${tx.id}` });
      }
    }

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev].slice(0, 50));
    }
  }, [recentTx]);

  // Tab title flashing
  useEffect(() => {
    if (notifications.length === 0) {
      document.title = originalTitle.current;
      return;
    }

    let visible = true;
    const interval = setInterval(() => {
      if (document.hidden) {
        visible = !visible;
        document.title = visible
          ? `🔔 (${notifications.length}) Nova Venda!`
          : originalTitle.current;
      } else {
        document.title = `(${notifications.length}) Nova transação! | Simplificando`;
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      document.title = originalTitle.current;
    };
  }, [notifications.length]);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissOne = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, dismissAll, dismissOne };
}
