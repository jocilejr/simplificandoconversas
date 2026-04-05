import { useState, useCallback } from "react";
import { useEmailSends } from "@/hooks/useEmailSends";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  sent: "bg-green-500/15 text-green-700 dark:text-green-400",
  failed: "bg-destructive/15 text-destructive",
};
const statusLabels: Record<string, string> = {
  pending: "Pendente", sent: "Enviado", failed: "Falhou",
};

export function EmailHistoryTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { sends, isLoading } = useEmailSends({
    status: statusFilter && statusFilter !== "__all__" ? statusFilter : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const handleExportCSV = useCallback(() => {
    if (sends.length === 0) return;
    const headers = ["Destinatário", "Nome", "Template", "Campanha", "Status", "Data", "Erro"];
    const rows = sends.map((s: any) => [
      s.recipient_email, s.recipient_name || "",
      s.email_templates?.name || "", s.email_campaigns?.name || "",
      statusLabels[s.status] || s.status,
      format(new Date(s.created_at), "dd/MM/yyyy HH:mm"),
      s.error_message || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `email-historico-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [sends]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter || "__all__"} onValueChange={(v) => { setStatusFilter(v === "__all__" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[160px] bg-card">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="failed">Falhas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={sends.length === 0} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>

        <p className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
          <Clock className="h-3 w-3" /> Atualiza a cada 30s
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : sends.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum envio encontrado</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Destinatário</TableHead>
                  <TableHead className="text-xs font-semibold">Template</TableHead>
                  <TableHead className="text-xs font-semibold">Campanha</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Aberto</TableHead>
                  <TableHead className="text-xs font-semibold">Data</TableHead>
                  <TableHead className="text-xs font-semibold">Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sends.map((s: any) => (
                  <TableRow key={s.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div>
                        <p className="text-sm text-foreground">{s.recipient_email}</p>
                        {s.recipient_name && <p className="text-[10px] text-muted-foreground">{s.recipient_name}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{s.email_templates?.name || "—"}</TableCell>
                    <TableCell className="text-xs">{s.email_campaigns?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[s.status] || ""}>
                        {statusLabels[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.opened_at ? format(new Date(s.opened_at), "dd/MM HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(s.created_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[180px] truncate">
                      {s.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Página {page + 1}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={sends.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
