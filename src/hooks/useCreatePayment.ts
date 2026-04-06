import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiUrl } from "@/lib/api";
import { toast } from "sonner";

interface CreatePaymentInput {
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_document?: string;
  amount: number;
  description?: string;
  type: "boleto" | "pix";
}

export interface PaymentResult {
  success: boolean;
  transaction_id: string;
  payment_url: string;
  barcode: string;
  qr_code: string;
  qr_code_base64: string;
  mp_id: number;
  status: string;
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput): Promise<PaymentResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const resp = await fetch(apiUrl("payment/create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(input),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar cobrança");
      }

      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Cobrança criada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
