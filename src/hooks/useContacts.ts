import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";

export interface Contact {
  remote_jid: string;
  contact_name: string | null;
  phone_number: string | null;
  instance_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  tags: string[];
}

export function useContacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 50;

  const { data: rawConversations = [], isLoading: isLoadingConvos } = useQuery({
    queryKey: ["contacts-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("remote_jid, contact_name, phone_number, instance_name, last_message, last_message_at")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allTags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ["contacts-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_tags")
        .select("remote_jid, tag_name");
      if (error) throw error;
      return data;
    },
  });

  // Deduplicate by remote_jid (keep most recent) and attach tags
  const contacts = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of rawConversations) {
      if (!map.has(c.remote_jid)) {
        map.set(c.remote_jid, {
          remote_jid: c.remote_jid,
          contact_name: c.contact_name,
          phone_number: c.phone_number,
          instance_name: c.instance_name,
          last_message: c.last_message,
          last_message_at: c.last_message_at,
          tags: [],
        });
      }
    }
    for (const t of allTags) {
      const contact = map.get(t.remote_jid);
      if (contact && !contact.tags.includes(t.tag_name)) {
        contact.tags.push(t.tag_name);
      }
    }
    return Array.from(map.values());
  }, [rawConversations, allTags]);

  // Unique tag names for filter
  const uniqueTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTags) set.add(t.tag_name);
    return Array.from(set).sort();
  }, [allTags]);

  // Filtered contacts
  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.contact_name?.toLowerCase().includes(q)) ||
          (c.phone_number?.toLowerCase().includes(q)) ||
          c.remote_jid.toLowerCase().includes(q)
      );
    }
    if (tagFilter) {
      list = list.filter((c) => c.tags.includes(tagFilter));
    }
    return list;
  }, [contacts, search, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // Create contact mutation
  const createContact = useMutation({
    mutationFn: async (input: { name: string; phone: string; instance_name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const remote_jid = input.phone.replace(/\D/g, "") + "@s.whatsapp.net";
      const { error } = await supabase.from("conversations").insert({
        user_id: user.id,
        remote_jid,
        contact_name: input.name || null,
        phone_number: input.phone,
        instance_name: input.instance_name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts-conversations"] });
      toast({ title: "Contato criado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar contato", description: err.message, variant: "destructive" });
    },
  });

  // CSV import mutation
  const importCSV = useMutation({
    mutationFn: async (rows: { name: string; phone: string }[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const records = rows.map((r) => ({
        user_id: user.id,
        remote_jid: r.phone.replace(/\D/g, "") + "@s.whatsapp.net",
        contact_name: r.name || null,
        phone_number: r.phone,
      }));
      const { error } = await supabase.from("conversations").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts-conversations"] });
      toast({ title: "Contatos importados com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao importar CSV", description: err.message, variant: "destructive" });
    },
  });

  return {
    contacts: paginated,
    totalContacts: filtered.length,
    isLoading: isLoadingConvos || isLoadingTags,
    search,
    setSearch,
    tagFilter,
    setTagFilter,
    uniqueTags,
    page,
    setPage,
    totalPages,
    createContact,
    importCSV,
  };
}
