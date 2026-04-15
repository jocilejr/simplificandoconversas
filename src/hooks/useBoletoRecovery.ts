import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useEffect } from "react";
import { addDays, differenceInDays, isBefore, startOfDay, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { getGreeting } from "@/lib/greeting";

const BRAZIL_TIMEZONE = "America/Sao_Paulo";

function getTodayBrazil(): Date {
  return startOfDay(toZonedTime(new Date(), BRAZIL_TIMEZONE));
}

function calcDaysSinceGeneration(createdAt: string): number {
  const created = startOfDay(toZonedTime(new Date(createdAt), BRAZIL_TIMEZONE));
  return differenceInDays(getTodayBrazil(), created);
}

export interface RecoveryRule {
  id: string;
  name: string;
  rule_type: "days_after_generation" | "days_before_due" | "days_after_due";
  days: number;
  message: string;
  is_active: boolean;
  priority: number;
  media_blocks?: any;
}

interface Transaction {
  id: string;
  amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_document: string | null;
  external_id: string | null;
  status: string;
  type: string;
  source: string;
  created_at: string;
  metadata: any;
  payment_url: string | null;
  description: string | null;
  paid_at: string | null;
  user_id: string;
  workspace_id: string;
}

export interface BoletoWithRecovery extends Transaction {
  dueDate: Date;
  daysUntilDue: number;
  daysSinceGeneration: number;
  isOverdue: boolean;
  applicableRule: RecoveryRule | null;
  formattedMessage: string | null;
  contactedToday: boolean;
  sendStatus: "pending" | "processing" | "sent" | "failed" | "skipped_phone_limit" | "skipped_invalid_phone" | "skipped_duplicate";
}

export function useBoletoRecovery() {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Realtime: auto-refresh when transactions change status
  useEffect(() => {
    const channel = supabase
      .channel("followup-transactions")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "transactions",
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unpaid-boletos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Query 1: unpaid boletos — same source as "Boletos Gerados" tab
  const { data: unpaidBoletos, isLoading } = useQuery({
    queryKey: ["unpaid-boletos", workspaceId],
    staleTime: 60000,
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("type", "boleto")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });

  // Query 2: active rules
  const { data: rules } = useQuery({
    queryKey: ["boleto-recovery-rules", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_recovery_rules" as any)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("is_active", true)
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RecoveryRule[];
    },
  });

  // Query 3: today's contacts
  const todayStr = format(getTodayBrazil(), "yyyy-MM-dd");
  const { data: todayContacts } = useQuery({
    queryKey: ["boleto-recovery-contacts-today", workspaceId, todayStr],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_recovery_contacts" as any)
        .select("transaction_id, rule_id, notes")
        .eq("workspace_id", workspaceId!)
        .gte("created_at", `${todayStr}T00:00:00-03:00`)
        .lt("created_at", `${todayStr}T23:59:59-03:00`);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Query 4: boleto settings
  const { data: settings } = useQuery({
    queryKey: ["boleto-settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_settings" as any)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Build contacted set and notes map
  const { contactedKeys, contactNotesMap } = useMemo(() => {
    const set = new Set<string>();
    const notesMap = new Map<string, string>();
    todayContacts?.forEach((c: any) => {
      if (c.transaction_id && c.rule_id) {
        const key = `${c.transaction_id}:${c.rule_id}`;
        set.add(key);
        if (c.notes) notesMap.set(key, c.notes);
      }
    });
    return { contactedKeys: set, contactNotesMap: notesMap };
  }, [todayContacts]);

  // Process boletos
  const processedBoletos = useMemo(() => {
    const boletos = unpaidBoletos ?? [];
    const expirationDays = settings?.default_expiration_days || 7;
    const today = getTodayBrazil();

    return boletos.map((boleto): BoletoWithRecovery => {
      const daysSinceGeneration = calcDaysSinceGeneration(boleto.created_at);
      const createdDay = startOfDay(toZonedTime(new Date(boleto.created_at), BRAZIL_TIMEZONE));
      const dueDate = addDays(createdDay, expirationDays);
      const daysUntilDue = differenceInDays(dueDate, today);
      const isOverdue = isBefore(dueDate, today);

      let applicableRule: RecoveryRule | null = null;
      if (rules) {
        for (const rule of rules) {
          let matches = false;
          if (rule.rule_type === "days_after_generation" && daysSinceGeneration === rule.days) matches = true;
          else if (rule.rule_type === "days_before_due" && daysUntilDue === rule.days) matches = true;
          else if (rule.rule_type === "days_after_due" && isOverdue && Math.abs(daysUntilDue) === rule.days) matches = true;
          if (matches) { applicableRule = rule; break; }
        }
      }

      const key = applicableRule ? `${boleto.id}:${applicableRule.id}` : null;
      const notes = key ? contactNotesMap.get(key) || "" : "";
      const contactedToday = key ? contactedKeys.has(key) && !notes.startsWith("failed") : false;

      let sendStatus: BoletoWithRecovery["sendStatus"] = "pending";
      if (contactedToday) {
        if (notes.startsWith("skipped_phone_limit")) sendStatus = "skipped_phone_limit";
        else if (notes.startsWith("skipped_invalid_phone")) sendStatus = "skipped_invalid_phone";
        else if (notes.startsWith("failed")) sendStatus = "failed";
        else sendStatus = "sent";
      }

      let formattedMessage: string | null = null;
      if (applicableRule) {
        formattedMessage = formatRecoveryMessage(applicableRule.message, boleto, dueDate);
      }

      return { ...boleto, dueDate, daysUntilDue, daysSinceGeneration, isOverdue, applicableRule, formattedMessage, contactedToday, sendStatus };
    });
  }, [unpaidBoletos, settings, rules, contactedKeys, contactNotesMap]);

  // Derived lists
  const todayBoletos = useMemo(() => processedBoletos.filter((b) => b.applicableRule !== null), [processedBoletos]);
  const pendingTodayBoletos = useMemo(() => todayBoletos.filter((b) => b.sendStatus === "pending" || b.sendStatus === "processing" || b.sendStatus === "failed"), [todayBoletos]);
  const sentTodayBoletos = useMemo(() => todayBoletos.filter((b) => b.sendStatus === "sent"), [todayBoletos]);
  const pendingBoletos = useMemo(() => processedBoletos.filter((b) => !b.isOverdue), [processedBoletos]);
  const overdueBoletos = useMemo(() => processedBoletos.filter((b) => b.isOverdue), [processedBoletos]);

  // Stats
  const stats = useMemo(() => ({
    totalToday: todayBoletos.length,
    sentToday: sentTodayBoletos.length,
    resolvedToday: sentTodayBoletos.length,
    pendingToday: pendingTodayBoletos.length,
    todayValue: todayBoletos.reduce((sum, b) => sum + Number(b.amount), 0),
    pendingCount: pendingBoletos.length,
    overdueCount: overdueBoletos.length,
    totalCount: processedBoletos.length,
  }), [todayBoletos, sentTodayBoletos, pendingTodayBoletos, pendingBoletos, overdueBoletos, processedBoletos]);

  // Manual contact mutation
  const addContact = useMutation({
    mutationFn: async ({ transactionId, ruleId, notes }: { transactionId: string; ruleId?: string; notes?: string }) => {
      if (!user?.id || !workspaceId) throw new Error("Not authenticated");
      const { error } = await supabase.from("boleto_recovery_contacts" as any).insert({
        workspace_id: workspaceId,
        user_id: user.id,
        transaction_id: transactionId,
        rule_id: ruleId || null,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boleto-recovery-contacts-today", workspaceId] });
    },
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (expirationDays: number) => {
      if (!workspaceId || !user?.id) throw new Error("No workspace");
      if (settings?.id) {
        const { error } = await supabase.from("boleto_settings" as any).update({ default_expiration_days: expirationDays }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("boleto_settings" as any).insert({ workspace_id: workspaceId, user_id: user.id, default_expiration_days: expirationDays });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boleto-settings", workspaceId] });
    },
  });

  return {
    settings, rules, processedBoletos, todayBoletos, pendingTodayBoletos, sentTodayBoletos,
    pendingBoletos, overdueBoletos, stats, addContact, updateSettings, isLoading,
  };
}

function formatRecoveryMessage(template: string, boleto: Transaction, dueDate: Date): string {
  const firstName = boleto.customer_name?.split(" ")[0] || "Cliente";
  const formattedAmount = Number(boleto.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedDueDate = dueDate.toLocaleDateString("pt-BR");
  const barcode = boleto.external_id || "";
  return template
    .replace(/{saudação}/gi, getGreeting())
    .replace(/{nome}/gi, boleto.customer_name || "Cliente")
    .replace(/{primeiro_nome}/gi, firstName)
    .replace(/{valor}/gi, formattedAmount)
    .replace(/{vencimento}/gi, formattedDueDate)
    .replace(/{codigo_barras}/gi, barcode);
}
