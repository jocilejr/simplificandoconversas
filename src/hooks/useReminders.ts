import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

async function getVpsConfig() {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("app_public_url")
      .maybeSingle();

    const { data: conn } = await (supabase as any)
      .from("platform_connections")
      .select("credentials")
      .eq("platform", "custom_api")
      .maybeSingle();

    const appUrl = profile?.app_public_url;
    const apiKey = conn?.credentials?.api_key;
    if (!appUrl || !apiKey) return null;

    return { apiUrl: appUrl.replace("app.", "api."), apiKey };
  } catch {
    return null;
  }
}

async function forwardToVps(method: "POST" | "PATCH" | "DELETE", path: string, body?: object) {
  const config = await getVpsConfig();
  if (!config) return;

  fetch(`${config.apiUrl}/api/platform${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).catch(() => {});
}

export interface Reminder {
  id: string;
  user_id: string;
  remote_jid: string;
  instance_name: string | null;
  contact_name: string | null;
  phone_number: string | null;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  created_at: string;
}

export type ReminderFilter = "all" | "pending" | "overdue" | "today" | "completed";

export function useReminders(filter: ReminderFilter = "all") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["reminders", filter],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      let query = (supabase as any)
        .from("reminders")
        .select("*")
        .order("due_date", { ascending: true });

      if (filter === "pending") {
        query = query.eq("completed", false);
      } else if (filter === "overdue") {
        query = query.eq("completed", false).lt("due_date", todayStart);
      } else if (filter === "today") {
        query = query.gte("due_date", todayStart).lt("due_date", todayEnd);
      } else if (filter === "completed") {
        query = query.eq("completed", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Reminder[];
    },
    enabled: !!user,
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (reminder: {
      remote_jid: string;
      contact_name?: string;
      phone_number?: string;
      instance_name?: string;
      title: string;
      description?: string;
      due_date: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await (supabase as any)
        .from("reminders")
        .insert({ ...reminder, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data as Reminder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      toast({ title: "Lembrete criado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar lembrete", description: err.message, variant: "destructive" });
    },
  });
}

export function useToggleReminder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await (supabase as any)
        .from("reminders")
        .update({ completed })
        .eq("id", id);
      if (error) throw error;
      return { id, completed };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      forwardToVps(variables.id, variables.completed);
    },
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      toast({ title: "Lembrete removido" });
    },
  });
}
