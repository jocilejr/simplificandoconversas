import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function ImportTransactions() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) throw new Error("Arquivo vazio ou sem dados");
    const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/"/g, ""));
    return lines.slice(1).map(line => {
      const values = line.split(/[,;]/).map(v => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    });
  };

  const mapRow = (row: Record<string, string>) => ({
    user_id: user!.id,
    source: "manual",
    type: row.tipo || row.type || "pix",
    status: row.status || "pago",
    amount: parseFloat((row.valor || row.amount || "0").replace(",", ".")) || 0,
    description: row.descricao || row.description || null,
    customer_name: row.nome || row.nome_cliente || row.customer_name || null,
    customer_email: row.email || row.customer_email || null,
    customer_phone: row.telefone || row.phone || row.customer_phone || null,
    customer_document: row.documento || row.cpf || row.cnpj || row.customer_document || null,
    created_at: row.data || row.date || new Date().toISOString(),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const mapped = rows.map(mapRow).filter(r => r.amount > 0);

      if (mapped.length === 0) {
        toast.error("Nenhuma transação válida encontrada no arquivo");
        return;
      }

      // Insert in batches of 100
      for (let i = 0; i < mapped.length; i += 100) {
        const batch = mapped.slice(i, i + 100);
        const { error } = await supabase.from("transactions").insert(batch as any);
        if (error) throw error;
      }

      toast.success(`${mapped.length} transações importadas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(`Erro ao importar: ${err.message}`);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Transações</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie um arquivo CSV com as colunas: <strong>tipo, valor, status, nome_cliente, email, telefone, documento, data</strong>
          </p>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button variant="secondary" asChild disabled={loading}>
                <span className="cursor-pointer">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    "Selecionar arquivo CSV"
                  )}
                </span>
              </Button>
            </label>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Separador aceito: vírgula (,) ou ponto e vírgula (;)</p>
            <p>• Valores monetários: use ponto ou vírgula decimal</p>
            <p>• Status aceitos: pago, pendente, cancelado, expirado</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
