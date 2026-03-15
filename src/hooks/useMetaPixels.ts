import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MetaPixel {
  id: string;
  user_id: string;
  name: string;
  pixel_id: string;
  access_token: string;
  created_at: string;
}

function parseSupabaseError(err: unknown): { message: string; status?: number; details?: string } {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const message = (e.message as string) || "Erro desconhecido";
    const httpStatus = typeof e._httpStatus === "number" ? e._httpStatus : undefined;
    const code = e.code as string;
    const status = httpStatus || (typeof e.status === "number" ? e.status : undefined);
    const details = (e.details as string) || (e.hint as string) || undefined;

    if (code?.startsWith("PGRST") || (status && status >= 400)) {
      return { message: message || `HTTP ${status}`, status, details };
    }
    return { message, status, details };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

function friendlyErrorMessage(parsed: { message: string; status?: number }): string {
  if (parsed.status === 404 || parsed.message?.includes("404")) {
    return "Tabela de pixels não disponível no backend. Rode o update da VPS novamente.";
  }
  if (parsed.message?.includes("JWT") || parsed.message?.includes("token")) {
    return "Sessão expirada. Faça login novamente.";
  }
  return parsed.message;
}

export function useMetaPixels() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pixels = [], isLoading } = useQuery({
    queryKey: ["meta-pixels"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("meta_pixels")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as MetaPixel[];
    },
  });

  const addPixel = useMutation({
    mutationFn: async (pixel: { name: string; pixel_id: string; access_token: string }) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error("[addPixel] Auth error:", JSON.stringify(authError));
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      if (!user) throw new Error("Not authenticated");

      const res = await supabase
        .from("meta_pixels")
        .insert({ ...pixel, user_id: user.id })
        .select();

      if (res.error) {
        console.error("[addPixel] Insert error:", JSON.stringify(res.error), "status:", res.status);
        const err: any = res.error;
        err._httpStatus = res.status;
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixels"] });
      toast({ title: "Pixel adicionado!" });
    },
    onError: (err: unknown) => {
      const parsed = parseSupabaseError(err);
      console.error("[addPixel] Mutation error:", parsed);
      toast({ title: "Erro ao adicionar pixel", description: friendlyErrorMessage(parsed), variant: "destructive" });
    },
  });

  const updatePixel = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; pixel_id?: string; access_token?: string }) => {
      const res = await supabase
        .from("meta_pixels")
        .update(updates)
        .eq("id", id)
        .select();

      if (res.error) {
        console.error("[updatePixel] Error:", JSON.stringify(res.error), "status:", res.status);
        const err: any = res.error;
        err._httpStatus = res.status;
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixels"] });
      toast({ title: "Pixel atualizado!" });
    },
    onError: (err: unknown) => {
      const parsed = parseSupabaseError(err);
      console.error("[updatePixel] Error:", parsed);
      toast({ title: "Erro ao atualizar", description: friendlyErrorMessage(parsed), variant: "destructive" });
    },
  });

  const deletePixel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meta_pixels")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("[deletePixel] Error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixels"] });
      toast({ title: "Pixel removido!" });
    },
    onError: (err: unknown) => {
      const parsed = parseSupabaseError(err);
      console.error("[deletePixel] Error:", parsed);
      toast({ title: "Erro ao remover", description: friendlyErrorMessage(parsed), variant: "destructive" });
    },
  });

  return { pixels, isLoading, addPixel, updatePixel, deletePixel };
}
