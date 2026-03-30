import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Transaction } from "@/hooks/useTransactions";
import { Search } from "lucide-react";

const statusColors: Record<string, string> = {
  pago: "bg-green-500/15 text-green-700 border-green-200",
  pendente: "bg-yellow-500/15 text-yellow-700 border-yellow-200",
  cancelado: "bg-red-500/15 text-red-700 border-red-200",
  expirado: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pago: "Pago",
  pendente: "Pendente",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const sourceLabels: Record<string, string> = {
  mercadopago: "Mercado Pago",
  openpix: "OpenPix",
  yampi: "Yampi",
  manual: "Manual",
};

const typeLabels: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão",
};

interface Props {
  transactions: Transaction[];
}

export function TransactionsTable({ transactions }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  const filtered = transactions.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterSource !== "all" && t.source !== filterSource) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (t.customer_name?.toLowerCase().includes(q)) ||
        (t.customer_email?.toLowerCase().includes(q)) ||
        (t.customer_phone?.includes(q)) ||
        (t.description?.toLowerCase().includes(q)) ||
        (t.external_id?.includes(q))
      );
    }
    return true;
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
            <SelectItem value="expirado">Expirado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="mercadopago">Mercado Pago</SelectItem>
            <SelectItem value="openpix">OpenPix</SelectItem>
            <SelectItem value="yampi">Yampi</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(t.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{t.customer_name || "—"}</span>
                      {t.customer_email && (
                        <span className="text-xs text-muted-foreground">{t.customer_email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[t.type] || t.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {sourceLabels[t.source] || t.source}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[t.status] || ""}>
                      {statusLabels[t.status] || t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(t.amount))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} de {transactions.length} transações
      </p>
    </div>
  );
}
