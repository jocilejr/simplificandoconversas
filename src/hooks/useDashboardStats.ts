import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PeriodFilter = "today" | "yesterday" | "7days" | "30days" | "custom";

interface DateRange {
  from: Date;
  to: Date;
}

function getDateRange(period: PeriodFilter, custom?: DateRange): { from: string; to: string } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  switch (period) {
    case "today":
      return { from: todayStart.toISOString(), to: todayEnd.toISOString() };
    case "yesterday": {
      const yStart = new Date(todayStart.getTime() - 86400000);
      return { from: yStart.toISOString(), to: todayStart.toISOString() };
    }
    case "7days":
      return { from: new Date(todayStart.getTime() - 7 * 86400000).toISOString(), to: todayEnd.toISOString() };
    case "30days":
      return { from: new Date(todayStart.getTime() - 30 * 86400000).toISOString(), to: todayEnd.toISOString() };
    case "custom":
      if (custom) {
        const cEnd = new Date(custom.to.getFullYear(), custom.to.getMonth(), custom.to.getDate() + 1);
        return { from: custom.from.toISOString(), to: cEnd.toISOString() };
      }
      return { from: todayStart.toISOString(), to: todayEnd.toISOString() };
  }
}

export function useDashboardStats(period: PeriodFilter, customRange?: DateRange) {
  const { user } = useAuth();
  const range = getDateRange(period, customRange);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const overdueReminders = useQuery({
    queryKey: ["dashboard", "overdue-reminders"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("completed", false)
        .lt("due_date", todayStart);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const todayReminders = useQuery({
    queryKey: ["dashboard", "today-reminders"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("completed", false)
        .gte("due_date", todayStart)
        .lt("due_date", todayEnd);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const conversationsInPeriod = useQuery({
    queryKey: ["dashboard", "conversations", period, customRange?.from?.toISOString()],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .gte("last_message_at", range.from)
        .lt("last_message_at", range.to);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const activeFlows = useQuery({
    queryKey: ["dashboard", "active-flows"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("chatbot_flows")
        .select("*", { count: "exact", head: true })
        .eq("active", true);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const messagesInPeriod = useQuery({
    queryKey: ["dashboard", "messages", period, customRange?.from?.toISOString()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("messages")
        .select("direction")
        .gte("created_at", range.from)
        .lt("created_at", range.to);
      if (error) throw error;
      const sent = (data || []).filter((m: any) => m.direction === "outbound").length;
      const received = (data || []).filter((m: any) => m.direction === "inbound").length;
      return { sent, received, total: sent + received };
    },
    enabled: !!user,
  });

  const executionsInPeriod = useQuery({
    queryKey: ["dashboard", "executions", period, customRange?.from?.toISOString()],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("flow_executions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", range.from)
        .lt("created_at", range.to);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const upcomingReminders = useQuery({
    queryKey: ["dashboard", "upcoming-reminders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reminders")
        .select("*")
        .eq("completed", false)
        .order("due_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const recentConversations = useQuery({
    queryKey: ["dashboard", "recent-conversations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const isLoading =
    overdueReminders.isLoading ||
    todayReminders.isLoading ||
    conversationsInPeriod.isLoading ||
    activeFlows.isLoading ||
    messagesInPeriod.isLoading ||
    executionsInPeriod.isLoading ||
    upcomingReminders.isLoading ||
    recentConversations.isLoading;

  return {
    isLoading,
    overdueReminders: overdueReminders.data ?? 0,
    todayReminders: todayReminders.data ?? 0,
    conversationsInPeriod: conversationsInPeriod.data ?? 0,
    activeFlows: activeFlows.data ?? 0,
    messages: messagesInPeriod.data ?? { sent: 0, received: 0, total: 0 },
    executionsInPeriod: executionsInPeriod.data ?? 0,
    upcomingReminders: upcomingReminders.data ?? [],
    recentConversations: recentConversations.data ?? [],
  };
}
