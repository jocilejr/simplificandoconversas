import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

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
  const { workspaceId } = useWorkspace();
  const range = getDateRange(period, customRange);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const enabled = !!user && !!workspaceId;

  const overdueReminders = useQuery({
    queryKey: ["dashboard", "overdue-reminders", workspaceId],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("completed", false)
        .lt("due_date", todayStart);
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  const todayReminders = useQuery({
    queryKey: ["dashboard", "today-reminders", workspaceId],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("completed", false)
        .gte("due_date", todayStart)
        .lt("due_date", todayEnd);
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  const conversationsInPeriod = useQuery({
    queryKey: ["dashboard", "conversations", workspaceId, period, customRange?.from?.toISOString()],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("last_message_at", range.from)
        .lt("last_message_at", range.to);
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  const activeFlows = useQuery({
    queryKey: ["dashboard", "active-flows", workspaceId],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("chatbot_flows")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("active", true);
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  const messagesInPeriod = useQuery({
    queryKey: ["dashboard", "messages", workspaceId, period, customRange?.from?.toISOString()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("messages")
        .select("direction")
        .eq("workspace_id", workspaceId)
        .gte("created_at", range.from)
        .lt("created_at", range.to);
      if (error) throw error;
      const sent = (data || []).filter((m: any) => m.direction === "outbound").length;
      const received = (data || []).filter((m: any) => m.direction === "inbound").length;
      return { sent, received, total: sent + received };
    },
    enabled,
  });

  const executionsInPeriod = useQuery({
    queryKey: ["dashboard", "executions", workspaceId, period, customRange?.from?.toISOString()],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("flow_executions")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", range.from)
        .lt("created_at", range.to);
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  const upcomingReminders = useQuery({
    queryKey: ["dashboard", "upcoming-reminders", workspaceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reminders")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("completed", false)
        .order("due_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  const recentConversations = useQuery({
    queryKey: ["dashboard", "recent-conversations", workspaceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conversations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled,
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
