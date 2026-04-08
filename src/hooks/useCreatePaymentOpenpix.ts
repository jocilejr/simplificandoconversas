import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiUrl } from "@/lib/api";
import { toast } from "sonner";
import type { PaymentResult } from "./useCreatePayment";
import { useWorkspace } from "./useWorkspace";

interface CreatePaymentInput {
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_document?: string;
  amount: number;
  description?: string;
}

export function useCreatePaymentOpenpix() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput): Promise<PaymentResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const resp = await fetch(apiUrl("payment-openpix/create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ...input, type: "pix" }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar cobrança OpenPix");
      }

      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Cobrança PIX criada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
