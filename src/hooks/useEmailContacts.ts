import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { normalizeEmail } from "@/lib/emailNormalizer";

export interface EmailContact {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  tags: string[];
  source: string;
  status: string;
  created_at: string;
}

export interface ProcessedEmail {
  email: string;
  original: string;
  status: "valid" | "corrected" | "invalid" | "duplicate";
  reason?: string;
}

export function useEmailContacts() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalContacts, setTotalContacts] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  const totalPages = perPage === 0 ? 1 : Math.max(1, Math.ceil(totalContacts / perPage));

  const fetchContacts = useCallback(async () => {
    if (!user || !workspaceId) return;
    setLoading(true);

    let query = supabase
      .from("email_contacts")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`email.ilike.${q},name.ilike.${q}`);
    }

    if (perPage > 0) {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Erro ao buscar contatos:", error.message);
    }

    setContacts((data as EmailContact[]) || []);
    setTotalContacts(count ?? 0);
    setLoading(false);
  }, [user, workspaceId, search, page, perPage]);

  const fetchActiveCount = useCallback(async () => {
    if (!user || !workspaceId) return;
    const { count } = await supabase
      .from("email_contacts")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active");
    setActiveCount(count ?? 0);
  }, [user, workspaceId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchActiveCount();
  }, [fetchActiveCount]);

  useEffect(() => {
    setPage(1);
  }, [search, perPage]);

  const addContact = async (email: string, name?: string, tags?: string[]) => {
    if (!user || !workspaceId) return;
    const result = normalizeEmail(email);

    if (result.status === "invalid") {
      toast.error(`E-mail inválido: ${result.reason || "formato não reconhecido"}`);
      return;
    }
    if (result.status === "ambiguous") {
      toast.error(`E-mail suspeito (${result.reason || "domínio não reconhecido"}). Verifique e tente novamente.`);
      return;
    }
    if (result.corrected) {
      toast.info(`E-mail corrigido: ${result.original} → ${result.email}`);
    }

    const { error } = await supabase.from("email_contacts").upsert(
      {
        user_id: user.id,
        workspace_id: workspaceId,
        email: result.email,
        name: name || null,
        tags: tags || [],
        source: "manual",
        status: "active",
      },
      { onConflict: "user_id,email" }
    );
    if (error) {
      toast.error("Erro ao adicionar contato: " + error.message);
      return;
    }
    toast.success("Contato adicionado!");
    fetchContacts();
    fetchActiveCount();
  };

  const deleteContact = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("email_contacts")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir contato");
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setTotalContacts((prev) => prev - 1);
    fetchActiveCount();
    toast.success("Contato excluído");
  };

  const processEmails = async (text: string): Promise<ProcessedEmail[]> => {
    if (!user || !workspaceId) return [];

    const raw = text
      .split(/[,;\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (raw.length === 0) return [];

    const processed: ProcessedEmail[] = raw.map((original) => {
      const result = normalizeEmail(original);
      if (result.status === "invalid") {
        return { email: original, original, status: "invalid" as const, reason: result.reason || "formato inválido" };
      }
      if (result.status === "ambiguous") {
        return { email: original, original, status: "invalid" as const, reason: result.reason || "domínio suspeito" };
      }
      if (result.corrected) {
        return { email: result.email, original: result.original || original, status: "corrected" as const, reason: `corrigido de ${result.original}` };
      }
      return { email: result.email, original, status: "valid" as const };
    });

    const validEmails = processed
      .filter((p) => p.status === "valid" || p.status === "corrected")
      .map((p) => p.email);

    if (validEmails.length > 0) {
      const existingSet = new Set<string>();
      for (let i = 0; i < validEmails.length; i += 500) {
        const batch = validEmails.slice(i, i + 500);
        const { data: existing } = await supabase
          .from("email_contacts")
          .select("email")
          .eq("workspace_id", workspaceId)
          .in("email", batch);
        (existing || []).forEach((e) => existingSet.add(e.email));
      }

      for (const p of processed) {
        if ((p.status === "valid" || p.status === "corrected") && existingSet.has(p.email)) {
          p.status = "duplicate";
          p.reason = "já existe na lista";
        }
      }
    }

    return processed;
  };

  const confirmBulkImport = async (emails: ProcessedEmail[]) => {
    if (!user || !workspaceId) return;

    const toInsert = emails.filter((e) => e.status === "valid" || e.status === "corrected");
    if (toInsert.length === 0) {
      toast.error("Nenhum e-mail novo para importar");
      return;
    }

    const rows = toInsert.map((e) => ({
      user_id: user.id,
      workspace_id: workspaceId,
      email: e.email.toLowerCase().trim(),
      name: null,
      tags: [],
      source: "import" as const,
      status: "active" as const,
    }));

    const seen = new Set<string>();
    const uniqueRows = rows.filter((r) => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

    for (let i = 0; i < uniqueRows.length; i += 500) {
      const batch = uniqueRows.slice(i, i + 500);
      const { error } = await supabase
        .from("email_contacts")
        .upsert(batch, { onConflict: "user_id,email" });
      if (error) {
        toast.error("Erro ao importar: " + error.message);
        return;
      }
    }

    toast.success(`${uniqueRows.length} e-mail(s) importado(s)!`);
    fetchContacts();
    fetchActiveCount();
  };

  const [fixing, setFixing] = useState(false);

  const fixEmails = async () => {
    if (!user || !workspaceId) return;
    setFixing(true);
    try {
      const { data: allContacts } = await supabase
        .from("email_contacts")
        .select("*")
        .eq("workspace_id", workspaceId);

      const all = (allContacts as EmailContact[]) || [];
      const toFix = all
        .map((c) => ({ ...c, result: normalizeEmail(c.email) }))
        .filter((c) => c.result.status === "corrected");

      if (toFix.length === 0) {
        toast.info("Todos os e-mails já estão corretos!");
        return;
      }

      let fixedCount = 0;
      for (const item of toFix) {
        const correctedEmail = item.result.email;
        const existing = all.find(
          (c) => c.id !== item.id && c.email === correctedEmail
        );
        if (existing) {
          await supabase
            .from("email_contacts")
            .delete()
            .eq("id", item.id);
        } else {
          await supabase
            .from("email_contacts")
            .update({ email: correctedEmail })
            .eq("id", item.id);
        }
        fixedCount++;
      }

      toast.success(`${fixedCount} e-mail(s) corrigido(s)!`);
      fetchContacts();
      fetchActiveCount();
    } catch (err) {
      console.error("Erro ao corrigir e-mails:", err);
      toast.error("Erro ao corrigir e-mails");
    } finally {
      setFixing(false);
    }
  };

  return {
    contacts,
    loading,
    search,
    setSearch,
    addContact,
    deleteContact,
    processEmails,
    confirmBulkImport,
    activeCount,
    refetch: fetchContacts,
    fixEmails,
    fixing,
    page,
    setPage,
    perPage,
    setPerPage,
    totalContacts,
    totalPages,
  };
}
