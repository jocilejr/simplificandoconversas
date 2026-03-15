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
        console.error("[addPixel] Auth error:", authError);
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("meta_pixels")
        .insert({ ...pixel, user_id: user.id });

      if (error) {
        console.error("[addPixel] Insert error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixels"] });
      toast({ title: "Pixel adicionado!" });
    },
    onError: (err: Error) => {
      console.error("[addPixel] Mutation error:", err);
      toast({ title: "Erro ao adicionar pixel", description: err.message, variant: "destructive" });
    },
  });

  const updatePixel = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; pixel_id?: string; access_token?: string }) => {
      const { error } = await supabase
        .from("meta_pixels")
        .update(updates)
        .eq("id", id);

      if (error) {
        console.error("[updatePixel] Error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixels"] });
      toast({ title: "Pixel atualizado!" });
    },
    onError: (err: Error) => {
      console.error("[updatePixel] Error:", err);
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
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
    onError: (err: Error) => {
      console.error("[deletePixel] Error:", err);
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  return { pixels, isLoading, addPixel, updatePixel, deletePixel };
}
