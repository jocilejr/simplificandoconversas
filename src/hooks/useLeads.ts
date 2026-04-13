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

/** Clean CPF: digits only, must be 11 chars */
const cleanCpf = (doc: string | null | undefined): string | null => {
  if (!doc) return null;
  const digits = doc.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
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

  // Index transactions by last-8-digits AND by CPF
  const { txByPhone, txByCpf } = useMemo(() => {
    const byPhone = new Map<string, Transaction[]>();
    const byCpf = new Map<string, Transaction[]>();
    for (const tx of allTransactions) {
      const key = matchKey(tx.customer_phone);
      if (key) {
        if (!byPhone.has(key)) byPhone.set(key, []);
        byPhone.get(key)!.push(tx);
      }
      const cpf = cleanCpf(tx.customer_document);
      if (cpf) {
        if (!byCpf.has(cpf)) byCpf.set(cpf, []);
        byCpf.get(cpf)!.push(tx);
      }
    }
    return { txByPhone: byPhone, txByCpf: byCpf };
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
    // 3 indices pointing to the same Lead object
    const cpfIndex = new Map<string, Lead>();
    const phoneIndex = new Map<string, Lead>();
    const last8Index = new Map<string, Lead>();
    const allLeads: Lead[] = [];

    const registerLead = (lead: Lead, cpf: string | null, phone: string | null, last8: string) => {
      if (cpf && !cpfIndex.has(cpf)) cpfIndex.set(cpf, lead);
      if (phone && !phoneIndex.has(phone)) phoneIndex.set(phone, lead);
      if (last8 && !last8Index.has(last8)) last8Index.set(last8, lead);
    };

    for (const c of rawConversations) {
      const jidDigits = c.remote_jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      if (jidDigits.length < 8) continue;

      const last8 = matchKey(c.remote_jid);
      if (!last8) continue;

      const normalizedPhone = displayPhone(c.phone_number || c.remote_jid.replace("@s.whatsapp.net", ""));

      // Find transactions for this conversation to get CPF
      const txsForConvo = txByPhone.get(last8) || [];
      const cpf = txsForConvo.map(t => cleanCpf(t.customer_document)).find(Boolean) || null;

      const instance: LeadInstance = {
        instance_name: c.instance_name,
        conversation_id: c.id,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
      };

      // Priority 1: CPF match
      let existingLead = cpf ? cpfIndex.get(cpf) : undefined;
      // Priority 2: Full normalized phone match
      if (!existingLead && normalizedPhone) existingLead = phoneIndex.get(normalizedPhone);
      // Priority 3: Last 8 digits match
      if (!existingLead) existingLead = last8Index.get(last8);

      if (existingLead) {
        existingLead.instances.push(instance);
        if (!existingLead.contact_name && c.contact_name) {
          existingLead.contact_name = c.contact_name;
        }
        if (!existingLead.phone_number && normalizedPhone) {
          existingLead.phone_number = normalizedPhone;
        }
        // Merge transactions from this conversation (deduplicated)
        const existingTxIds = new Set(existingLead.transactions.map(t => t.id));
        const newTxs = txsForConvo.filter(t => !existingTxIds.has(t.id));
        if (cpf) {
          for (const t of (txByCpf.get(cpf) || [])) {
            if (!existingTxIds.has(t.id) && !newTxs.some(n => n.id === t.id)) {
              newTxs.push(t);
            }
          }
        }
        if (newTxs.length > 0) {
          existingLead.transactions.push(...newTxs);
          const approvedTxs = existingLead.transactions.filter(t => t.status === "aprovado");
          existingLead.hasPaid = approvedTxs.length > 0;
          existingLead.totalPaid = approvedTxs.reduce((s, t) => s + Number(t.amount), 0);
          existingLead.paidOrdersCount = approvedTxs.length;
        }
        // Merge email & document from transactions if missing
        if (!existingLead.customer_email || !existingLead.customer_document) {
          const txWithData = existingLead.transactions.find(t => t.customer_email || t.customer_document);
          if (txWithData) {
            if (!existingLead.customer_email) existingLead.customer_email = txWithData.customer_email || null;
            if (!existingLead.customer_document) existingLead.customer_document = txWithData.customer_document || null;
          }
        }
        // Merge reminders count
        const mergedReminders = remindersByKey.get(last8) || 0;
        if (mergedReminders > existingLead.remindersCount) {
          existingLead.remindersCount = mergedReminders;
        }
        // Update last_message if newer
        if (c.last_message_at && (!existingLead.last_message_at || c.last_message_at > existingLead.last_message_at)) {
          existingLead.last_message = c.last_message;
          existingLead.last_message_at = c.last_message_at;
        }
        // Register any new indices for this merged lead
        registerLead(existingLead, cpf, normalizedPhone, last8);
        continue;
      }

      // Collect all transactions: by CPF first, then by phone (deduplicated)
      const txSet = new Set<string>();
      const txs: Transaction[] = [];
      if (cpf) {
        for (const t of (txByCpf.get(cpf) || [])) {
          if (!txSet.has(t.id)) { txSet.add(t.id); txs.push(t); }
        }
      }
      for (const t of txsForConvo) {
        if (!txSet.has(t.id)) { txSet.add(t.id); txs.push(t); }
      }

      const approvedTxs = txs.filter((t) => t.status === "aprovado");
      const firstTxWithData = txs.find((t) => t.customer_email || t.customer_document);

      const lead: Lead = {
        remote_jid: c.remote_jid,
        contact_name: c.contact_name,
        phone_number: normalizedPhone,
        instance_name: c.instance_name,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        tags: [],
        hasPaid: approvedTxs.length > 0,
        totalPaid: approvedTxs.reduce((s, t) => s + Number(t.amount), 0),
        paidOrdersCount: approvedTxs.length,
        remindersCount: remindersByKey.get(last8) || 0,
        transactions: txs,
        customer_email: firstTxWithData?.customer_email || null,
        customer_document: firstTxWithData?.customer_document || null,
        instances: [instance],
      };

      allLeads.push(lead);
      registerLead(lead, cpf, normalizedPhone, last8);
    }

    // Attach tags
    for (const t of allTags) {
      const key = matchKey(t.remote_jid);
      const lead = last8Index.get(key) || phoneIndex.get(displayPhone(t.remote_jid) || "");
      if (lead && !lead.tags.includes(t.tag_name)) {
        lead.tags.push(t.tag_name);
      }
    }

    return allLeads;
  }, [rawConversations, allTags, txByPhone, txByCpf, remindersByKey]);

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

  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case "name":
          return dir * (a.contact_name || "").localeCompare(b.contact_name || "");
        case "phone":
          return dir * (a.phone_number || "").localeCompare(b.phone_number || "");
        case "orders":
          return dir * (a.paidOrdersCount - b.paidOrdersCount);
        case "total":
          return dir * (a.totalPaid - b.totalPaid);
        case "reminders":
          return dir * (a.remindersCount - b.remindersCount);
        case "status":
          return dir * (Number(a.hasPaid) - Number(b.hasPaid));
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("asc");
      return field;
    });
    setPage(1);
  }, []);

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
    totalLeads: sorted.length,
    isLoading: isLoadingConvos || isLoadingTags || isLoadingTx,
    search, setSearch,
    tagFilter, setTagFilter,
    paymentFilter, setPaymentFilter,
    uniqueTags,
    page, setPage,
    totalPages,
    counts,
    sortField, sortDir, handleSort,
    createContact,
    importCSV,
  };
}
