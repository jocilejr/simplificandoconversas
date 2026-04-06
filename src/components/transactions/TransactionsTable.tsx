import { useState, useMemo } from "react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, ExternalLink, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@/hooks/useTransactions";
import { TransactionDetailDialog } from "./TransactionDetailDialog";

interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading: boolean;
}

const statusColors: Record<string, string> = {
  aprovado: "bg-green-500/10 text-green-600 border-green-500/30",
  pendente: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  rejeitado: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelado: "bg-red-500/10 text-red-600 border-red-500/30",
  processando: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  reembolsado: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  estornado: "bg-purple-500/10 text-purple-600 border-purple-500/30",
};

const typeLabels: Record<string, string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
  card: "Cartão",
};

export function TransactionsTable({ transactions, isLoading }: TransactionsTableProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("todos");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const queryClient = useQueryClient();

  const filtered = useMemo(() => {
    let txs = transactions;

    if (tab === "boletos") txs = txs.filter((t) => t.type === "boleto");
    else if (tab === "pix-cartao-pendente") txs = txs.filter((t) => t.type !== "boleto" && t.status === "pendente");
    else if (tab === "aprovados") txs = txs.filter((t) => t.status === "aprovado");

    if (search) {
      const s = search.toLowerCase();
      txs = txs.filter(
        (t) =>
          t.customer_name?.toLowerCase().includes(s) ||
          t.customer_phone?.includes(s) ||
          t.customer_document?.includes(s) ||
          t.customer_email?.toLowerCase().includes(s)
      );
    }

    return txs;
  }, [transactions, tab, search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir esta transação?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Transação excluída");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="todos">Todos ({transactions.length})</TabsTrigger>
            <TabsTrigger value="boletos">
              Boletos ({transactions.filter((t) => t.type === "boleto").length})
            </TabsTrigger>
            <TabsTrigger value="pix-cartao-pendente">
              PIX/Cartão Pendente ({transactions.filter((t) => t.type !== "boleto" && t.status === "pendente").length})
            </TabsTrigger>
            <TabsTrigger value="aprovados">
              Aprovados ({transactions.filter((t) => t.status === "aprovado").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead className="hidden lg:table-cell">CPF</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => (
                <TableRow key={tx.id} className="cursor-pointer" onClick={() => setSelectedTx(tx)}>
                  <TableCell>
                    <Badge variant="outline">{typeLabels[tx.type] || tx.type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{tx.customer_name || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell">{tx.customer_phone || "-"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{tx.customer_document || "-"}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(tx.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[tx.status] || ""} variant="outline">
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {tx.payment_url && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              navigator.clipboard.writeText(tx.payment_url!);
                              toast.success("Link copiado!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                            <a href={tx.payment_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(tx.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TransactionDetailDialog
        transaction={selectedTx}
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}
