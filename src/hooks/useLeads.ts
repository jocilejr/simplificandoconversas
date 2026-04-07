import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMemo, useState } from "react";
import type { Transaction } from "@/hooks/useTransactions";

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
}

const normalizePhone = (phone: string | null | undefined) =>
  phone ? phone.replace(/\D/g, "").slice(-8) : "";

export function useLeads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [page, setPage] = useState(1);
  const perPage = 50;

  const { data: rawConversations = [], isLoading: isLoadingConvos } = useQuery({
    queryKey: ["leads-conversations", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at")
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
      const key = normalizePhone(tx.customer_phone);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return map;
  }, [allTransactions]);

  const remindersByJid = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allReminders) {
      map.set(r.remote_jid, (map.get(r.remote_jid) || 0) + 1);
    }
    return map;
  }, [allReminders]);

  const leads = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const c of rawConversations) {
      if (!map.has(c.remote_jid)) {
        const jidDigits = c.remote_jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        if (jidDigits.length < 12 || jidDigits.length > 13) continue;

        const phoneKey = normalizePhone(c.phone_number || c.remote_jid);
        const txs = txByPhone.get(phoneKey) || [];
        const approvedTxs = txs.filter((t) => t.status === "aprovado");
        const firstTxWithData = txs.find((t) => t.customer_email || t.customer_document);

        map.set(c.remote_jid, {
          remote_jid: c.remote_jid,
          contact_name: c.contact_name,
          phone_number: c.phone_number,
          instance_name: c.instance_name,
          last_message: c.last_message,
          last_message_at: c.last_message_at,
          tags: [],
          hasPaid: approvedTxs.length > 0,
          totalPaid: approvedTxs.reduce((s, t) => s + Number(t.amount), 0),
          paidOrdersCount: approvedTxs.length,
          remindersCount: remindersByJid.get(c.remote_jid) || 0,
          transactions: txs,
          customer_email: firstTxWithData?.customer_email || null,
          customer_document: firstTxWithData?.customer_document || null,
        });
      }
    }
    for (const t of allTags) {
      const lead = map.get(t.remote_jid);
      if (lead && !lead.tags.includes(t.tag_name)) {
        lead.tags.push(t.tag_name);
      }
    }
    return Array.from(map.values());
  }, [rawConversations, allTags, txByPhone, remindersByJid]);

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
