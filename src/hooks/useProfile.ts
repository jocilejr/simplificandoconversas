import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // Auto-create profile if it doesn't exist (self-hosted edge case)
      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({ user_id: user.id })
          .select()
          .single();
        if (insertError) throw insertError;
        data = newProfile;
      }

      return data;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: {
      full_name?: string;
      evolution_api_url?: string;
      evolution_api_key?: string;
      evolution_instance_name?: string;
      openai_api_key?: string;
      app_public_url?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Salvo com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "test-connection" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const state = data?.instance?.state || data?.state;
      toast({
        title: state === "open" ? "Conectado!" : "Status da conexão",
        description: state || JSON.stringify(data),
        variant: state === "open" ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro na conexão", description: err.message, variant: "destructive" });
    },
  });

  return { profile, isLoading, updateProfile, testConnection };
}
