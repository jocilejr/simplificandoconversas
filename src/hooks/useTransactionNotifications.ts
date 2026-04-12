import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";

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
  const permissionAsked = useRef(false);

  // Request permission once
  useEffect(() => {
    if (permissionAsked.current) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      permissionAsked.current = true;
      Notification.requestPermission();
    }
  }, []);

  // Listen for new transactions
  useEffect(() => {
    if (!user || !workspaceId) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const channel = supabase
      .channel("tx-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const row = payload.new as any;
          if (row.workspace_id !== workspaceId) return;

          const info = getNotificationInfo(row.type, row.status);
          if (!info) return;

          const name = row.customer_name || "Cliente";
          const amount = row.amount ? formatCurrency(Number(row.amount)) : "";
          const body = amount ? `${name} — ${amount}` : name;

          new Notification(`${info.icon} ${info.title}`, {
            body,
            tag: `tx-${row.id}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, workspaceId]);
}
