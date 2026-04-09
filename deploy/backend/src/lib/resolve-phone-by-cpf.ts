import { getServiceClient } from "./supabase";

/**
 * Given a CPF (customer_document) and workspace_id, search existing transactions
 * that have the same CPF AND a customer_phone already set.
 * Returns the phone if found, null otherwise.
 */
export async function resolvePhoneByCpf(
  cpf: string | null | undefined,
  workspaceId: string
): Promise<string | null> {
  if (!cpf) return null;
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length < 11) return null;

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("transactions")
    .select("customer_phone")
    .eq("workspace_id", workspaceId)
    .eq("customer_document", cleaned)
    .not("customer_phone", "is", null)
    .limit(1)
    .maybeSingle();

  return data?.customer_phone || null;
}
