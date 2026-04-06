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

export interface AnalyzedContact {
  email: string;
  name: string | null;
  tags: string[];
  status: "valid" | "corrected" | "invalid";
  original_email?: string;
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

  const analyzeCSV = async (file: File): Promise<AnalyzedContact[] | null> => {
    if (!user) return null;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast.error("CSV vazio ou sem dados");
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke("analyze-csv-contacts", {
        body: { csv_text: text },
      });

      if (error) {
        toast.error("Erro ao analisar CSV: " + error.message);
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data.contacts as AnalyzedContact[];
    } catch (err) {
      console.error("Erro na análise de CSV:", err);
      toast.error("Erro ao analisar CSV com IA");
      return null;
    }
  };

  const confirmImport = async (analyzedContacts: AnalyzedContact[]) => {
    if (!user) return;

    const validContacts = analyzedContacts.filter((c) => c.status !== "invalid");
    if (validContacts.length === 0) {
      toast.error("Nenhum contato válido para importar");
      return;
    }

    const rows = validContacts.map((c) => ({
      user_id: user.id,
      email: c.email.toLowerCase().trim(),
      name: c.name || null,
      tags: c.tags || [],
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

    const corrected = analyzedContacts.filter((c) => c.status === "corrected").length;
    const invalid = analyzedContacts.filter((c) => c.status === "invalid").length;
    const msgs: string[] = [`${validContacts.length} contatos importados!`];
    if (corrected > 0) msgs.push(`${corrected} corrigidos`);
    if (invalid > 0) msgs.push(`${invalid} ignorados`);
    toast.success(msgs.join(" · "));
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
    analyzeCSV,
    confirmImport,
    activeCount,
    refetch: fetchContacts,
    fixEmails,
    fixing,
  };
}
