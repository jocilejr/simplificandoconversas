import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("email_contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erro ao buscar contatos:", error.message);
    }
    setContacts((data as EmailContact[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const addContact = async (email: string, name?: string, tags?: string[]) => {
    if (!user) return;
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
  };

  const deleteContact = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("email_contacts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao excluir contato");
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contato excluído");
  };

  const processEmails = async (text: string): Promise<ProcessedEmail[]> => {
    if (!user) return [];

    const raw = text
      .split(/[,;\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (raw.length === 0) return [];

    // Normalize all emails
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

    // Check duplicates against DB
    const validEmails = processed
      .filter((p) => p.status === "valid" || p.status === "corrected")
      .map((p) => p.email);

    if (validEmails.length > 0) {
      const { data: existing } = await supabase
        .from("email_contacts")
        .select("email")
        .eq("user_id", user.id)
        .in("email", validEmails);

      const existingSet = new Set((existing || []).map((e) => e.email));

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
    if (!user) return;

    const toInsert = emails.filter((e) => e.status === "valid" || e.status === "corrected");
    if (toInsert.length === 0) {
      toast.error("Nenhum e-mail novo para importar");
      return;
    }

    const rows = toInsert.map((e) => ({
      user_id: user.id,
      email: e.email.toLowerCase().trim(),
      name: null,
      tags: [],
      source: "import" as const,
      status: "active" as const,
    }));

    const { error } = await supabase
      .from("email_contacts")
      .upsert(rows, { onConflict: "user_id,email" });

    if (error) {
      toast.error("Erro ao importar: " + error.message);
      return;
    }

    toast.success(`${toInsert.length} e-mail(s) importado(s)!`);
    fetchContacts();
  };

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name && c.name.toLowerCase().includes(q))
    );
  });

  const activeCount = contacts.filter((c) => c.status === "active").length;

  const [fixing, setFixing] = useState(false);

  const fixEmails = async () => {
    if (!user) return;
    setFixing(true);
    try {
      const toFix = contacts
        .map((c) => ({ ...c, result: normalizeEmail(c.email) }))
        .filter((c) => c.result.status === "corrected");

      if (toFix.length === 0) {
        toast.info("Todos os e-mails já estão corretos!");
        return;
      }

      let fixedCount = 0;
      for (const item of toFix) {
        const correctedEmail = item.result.email;
        const existing = contacts.find(
          (c) => c.id !== item.id && c.email === correctedEmail
        );
        if (existing) {
          await supabase
            .from("email_contacts")
            .delete()
            .eq("id", item.id)
            .eq("user_id", user.id);
        } else {
          await supabase
            .from("email_contacts")
            .update({ email: correctedEmail })
            .eq("id", item.id)
            .eq("user_id", user.id);
        }
        fixedCount++;
      }

      toast.success(`${fixedCount} e-mail(s) corrigido(s)!`);
      fetchContacts();
    } catch (err) {
      console.error("Erro ao corrigir e-mails:", err);
      toast.error("Erro ao corrigir e-mails");
    } finally {
      setFixing(false);
    }
  };

  return {
    contacts: filtered,
    allContacts: contacts,
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
  };
}
