import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

async function sendWebhookToExternal(event: string, data: object) {
  try {
    const { data: conn } = await (supabase as any)
      .from("platform_connections")
      .select("credentials")
      .eq("platform", "external_app")
      .maybeSingle();

    const creds = conn?.credentials as any;
    const url = creds?.webhook_url;
    if (!url) return;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (creds?.api_key) headers["X-API-Key"] = creds.api_key;

    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), data }),
    }).catch(() => {});
  } catch {}
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      toast({ title: "Lembrete criado com sucesso" });
      sendWebhookToExternal("reminder_created", data);
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
      sendWebhookToExternal("reminder_updated", { id: variables.id, completed: variables.completed });
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
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      toast({ title: "Lembrete removido" });
      forwardToVps("DELETE", `/reminders/${id}`);
    },
  });
}
