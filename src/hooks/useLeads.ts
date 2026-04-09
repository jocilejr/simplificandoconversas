import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMemo, useState, useCallback } from "react";
import type { Transaction } from "@/hooks/useTransactions";

type SortField = "name" | "phone" | "orders" | "total" | "reminders" | "status";
type SortDir = "asc" | "desc";

export interface LeadInstance {
  instance_name: string | null;
  conversation_id: string;
  last_message: string | null;
  last_message_at: string | null;
}

export interface Lead {
  remote_jid: string;
  contact_name: string | null;
  phone_number: string | null;
  instance_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  tags: string[];
  hasPaid: boolean;
  totalPaid: number;
  paidOrdersCount: number;
  remindersCount: number;
  transactions: Transaction[];
  customer_email: string | null;
  customer_document: string | null;
  instances: LeadInstance[];
}

const matchKey = (phone: string | null | undefined) =>
  phone ? phone.replace(/\D/g, "").slice(-8) : "";

const displayPhone = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  let phone = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith("55"))
    phone = "55" + phone;
  return phone || null;
};

export function useLeads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const perPage = 50;

  const { data: rawConversations = [], isLoading: isLoadingConvos } = useQuery({
    queryKey: ["leads-conversations", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at")
        .eq("workspace_id", workspaceId!)
        .not("remote_jid", "like", "%@lid")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allTags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ["leads-tags", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_tags")
        .select("remote_jid, tag_name")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: allTransactions = [], isLoading: isLoadingTx } = useQuery({
    queryKey: ["leads-transactions", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });

  const { data: allReminders = [] } = useQuery({
    queryKey: ["leads-reminders", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("remote_jid")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      return data || [];
    },
  });

  const txByPhone = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of allTransactions) {
      const key = matchKey(tx.customer_phone);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return map;
  }, [allTransactions]);

  const remindersByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allReminders) {
      const key = matchKey(r.remote_jid);
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [allReminders]);

  const leads = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const c of rawConversations) {
      const jidDigits = c.remote_jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      if (jidDigits.length < 8) continue;

      const key = matchKey(c.remote_jid);
      if (!key) continue;

      const instance: LeadInstance = {
        instance_name: c.instance_name,
        conversation_id: c.id,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
      };

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.instances.push(instance);
        if (!existing.contact_name && c.contact_name) {
          existing.contact_name = c.contact_name;
        }
        continue;
      }

      const txs = txByPhone.get(key) || [];
      const approvedTxs = txs.filter((t) => t.status === "aprovado");
      const firstTxWithData = txs.find((t) => t.customer_email || t.customer_document);

      map.set(key, {
        remote_jid: c.remote_jid,
        contact_name: c.contact_name,
        phone_number: displayPhone(c.phone_number || c.remote_jid.replace("@s.whatsapp.net", "")),
        instance_name: c.instance_name,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        tags: [],
        hasPaid: approvedTxs.length > 0,
        totalPaid: approvedTxs.reduce((s, t) => s + Number(t.amount), 0),
        paidOrdersCount: approvedTxs.length,
        remindersCount: remindersByKey.get(key) || 0,
        transactions: txs,
        customer_email: firstTxWithData?.customer_email || null,
        customer_document: firstTxWithData?.customer_document || null,
        instances: [instance],
      });
    }
    for (const t of allTags) {
      const lead = map.get(matchKey(t.remote_jid));
      if (lead && !lead.tags.includes(t.tag_name)) {
        lead.tags.push(t.tag_name);
      }
    }
    return Array.from(map.values());
  }, [rawConversations, allTags, txByPhone, remindersByKey]);

  const uniqueTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTags) set.add(t.tag_name);
    return Array.from(set).sort();
  }, [allTags]);

  const filtered = useMemo(() => {
    let list = leads;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.contact_name?.toLowerCase().includes(q) ||
          c.phone_number?.toLowerCase().includes(q) ||
          c.remote_jid.toLowerCase().includes(q)
      );
    }
    if (tagFilter) {
      list = list.filter((c) => c.tags.includes(tagFilter));
    }
    if (paymentFilter === "paid") {
      list = list.filter((c) => c.hasPaid);
    } else if (paymentFilter === "unpaid") {
      list = list.filter((c) => !c.hasPaid);
    }
    return list;
  }, [leads, search, tagFilter, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const counts = useMemo(() => ({
    all: leads.length,
    paid: leads.filter((l) => l.hasPaid).length,
    unpaid: leads.filter((l) => !l.hasPaid).length,
  }), [leads]);

  const createContact = useMutation({
    mutationFn: async (input: { name: string; phone: string; instance_name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const remote_jid = input.phone.replace(/\D/g, "") + "@s.whatsapp.net";
      const { error } = await supabase.from("conversations").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        remote_jid,
        contact_name: input.name || null,
        phone_number: input.phone,
        instance_name: input.instance_name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-conversations"] });
      toast({ title: "Lead criado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar lead", description: err.message, variant: "destructive" });
    },
  });

  const importCSV = useMutation({
    mutationFn: async (rows: { name: string; phone: string }[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const records = rows.map((r) => ({
        user_id: user.id,
        workspace_id: workspaceId,
        remote_jid: r.phone.replace(/\D/g, "") + "@s.whatsapp.net",
        contact_name: r.name || null,
        phone_number: r.phone,
      }));
      const { error } = await supabase.from("conversations").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-conversations"] });
      toast({ title: "Leads importados com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao importar CSV", description: err.message, variant: "destructive" });
    },
  });

  return {
    leads: paginated,
    allLeads: filtered,
    totalLeads: filtered.length,
    isLoading: isLoadingConvos || isLoadingTags || isLoadingTx,
    search, setSearch,
    tagFilter, setTagFilter,
    paymentFilter, setPaymentFilter,
    uniqueTags,
    page, setPage,
    totalPages,
    counts,
    createContact,
    importCSV,
  };
}
