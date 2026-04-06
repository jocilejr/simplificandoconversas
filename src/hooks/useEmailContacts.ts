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

  const importCSV = async (file: File) => {
    if (!user) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast.error("CSV vazio ou sem dados");
      return;
    }

    const header = lines[0].toLowerCase();
    const sep = header.includes(";") ? ";" : ",";
    const cols = header.split(sep).map((c) => c.trim());
    const emailIdx = cols.findIndex((c) => c === "email" || c === "e-mail");
    const nameIdx = cols.findIndex((c) => c === "nome" || c === "name");

    if (emailIdx === -1) {
      toast.error('Coluna "email" não encontrada no CSV');
      return;
    }

    let correctedCount = 0;
    const rows = lines.slice(1).map((line) => {
      const parts = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
      const rawEmail = parts[emailIdx]?.trim() || "";
      const result = normalizeEmail(rawEmail);
      if (result.corrected) correctedCount++;
      return {
        user_id: user.id,
        email: result.email,
        name: nameIdx >= 0 ? parts[nameIdx] || null : null,
        tags: [] as string[],
        source: "import" as const,
        status: "active" as const,
      };
    }).filter((r) => r.email && r.email.includes("@"));

    if (rows.length === 0) {
      toast.error("Nenhum e-mail válido encontrado no CSV");
      return;
    }

    const { error } = await supabase
      .from("email_contacts")
      .upsert(rows, { onConflict: "user_id,email" });

    if (error) {
      toast.error("Erro ao importar: " + error.message);
      return;
    }
    const corrMsg = correctedCount > 0 ? ` (${correctedCount} e-mails corrigidos)` : "";
    toast.success(`${rows.length} contatos importados!${corrMsg}`);
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

  return {
    contacts: filtered,
    allContacts: contacts,
    loading,
    search,
    setSearch,
    addContact,
    deleteContact,
    importCSV,
    activeCount,
    refetch: fetchContacts,
  };
}
