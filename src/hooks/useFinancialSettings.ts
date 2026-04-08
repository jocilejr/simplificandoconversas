import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface FinancialSettings {
  id?: string;
  workspace_id: string;
  boleto_fee_type: "fixed" | "percent";
  boleto_fee_value: number;
  pix_fee_type: "fixed" | "percent";
  pix_fee_value: number;
  cartao_fee_type: "fixed" | "percent";
  cartao_fee_value: number;
  tax_type: "fixed" | "percent";
  tax_value: number;
  tax_name: string;
}

export function useFinancialSettings() {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["financial-settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_settings")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data as FinancialSettings | null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Omit<FinancialSettings, "id" | "workspace_id">) => {
      const payload = {
        ...values,
        workspace_id: workspaceId!,
        user_id: user!.id,
      };

      const { error } = await supabase
        .from("financial_settings")
        .upsert(payload, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-settings", workspaceId] });
      toast.success("Taxas salvas com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar taxas");
    },
  });

  return { settings, isLoading, save: saveMutation.mutate, isSaving: saveMutation.isPending };
}
