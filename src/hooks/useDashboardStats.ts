import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DashboardStats {
  remindersInPeriod: { total: number; pending: number; completed: number };
  remindersOverdue: number;
  conversationsInPeriod: number;
  activeFlows: number;
  executionsInPeriod: number;
  messagesInPeriod: { total: number; inbound: number; outbound: number };
  recentReminders: Array<{
    id: string;
    title: string;
    contact_name: string | null;
    due_date: string;
    completed: boolean;
  }>;
  recentConversations: Array<{
    id: string;
    contact_name: string | null;
    phone_number: string | null;
    last_message: string | null;
    last_message_at: string | null;
  }>;
}

export function useDashboardStats(startDate: string, endDate: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats", startDate, endDate],
    enabled: !!user,
    queryFn: async (): Promise<DashboardStats> => {
      const [
        remindersRes,
        overdueRes,
        convsRes,
        flowsRes,
        execsRes,
        msgsRes,
        recentRemindersRes,
        recentConvsRes,
      ] = await Promise.all([
        // Reminders in period
        (supabase as any)
          .from("reminders")
          .select("completed")
          .gte("due_date", startDate)
          .lt("due_date", endDate),

        // Overdue reminders (pending, due before start)
        (supabase as any)
          .from("reminders")
          .select("id", { count: "exact", head: true })
          .eq("completed", false)
          .lt("due_date", startDate),

        // Conversations in period
        (supabase as any)
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .gte("last_message_at", startDate)
          .lt("last_message_at", endDate),

        // Active flows (always current)
        supabase
          .from("chatbot_flows")
          .select("id", { count: "exact", head: true })
          .eq("active", true),

        // Executions in period
        (supabase as any)
          .from("flow_executions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startDate)
          .lt("created_at", endDate),

        // Messages in period
        (supabase as any)
          .from("messages")
          .select("direction")
          .gte("created_at", startDate)
          .lt("created_at", endDate),

        // Recent reminders (pending, in period or overdue)
        (supabase as any)
          .from("reminders")
          .select("id, title, contact_name, due_date, completed")
          .eq("completed", false)
          .order("due_date", { ascending: true })
          .limit(5),

        // Recent conversations in period
        (supabase as any)
          .from("conversations")
          .select("id, contact_name, phone_number, last_message, last_message_at")
          .gte("last_message_at", startDate)
          .lt("last_message_at", endDate)
          .order("last_message_at", { ascending: false })
          .limit(5),
      ]);

      const reminders = remindersRes.data || [];
      const pending = reminders.filter((r: any) => !r.completed).length;
      const completed = reminders.filter((r: any) => r.completed).length;

      const msgs = msgsRes.data || [];
      const inbound = msgs.filter((m: any) => m.direction === "inbound").length;
      const outbound = msgs.filter((m: any) => m.direction === "outbound").length;

      return {
        remindersInPeriod: { total: reminders.length, pending, completed },
        remindersOverdue: overdueRes.count || 0,
        conversationsInPeriod: convsRes.count || 0,
        activeFlows: flowsRes.count || 0,
        executionsInPeriod: execsRes.count || 0,
        messagesInPeriod: { total: msgs.length, inbound, outbound },
        recentReminders: recentRemindersRes.data || [],
        recentConversations: recentConvsRes.data || [],
      };
    },
  });
}
