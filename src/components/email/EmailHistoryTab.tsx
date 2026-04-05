import { useState, useCallback } from "react";
import { useEmailSends } from "@/hooks/useEmailSends";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, ChevronLeft, ChevronRight, Mail, MailCheck, MailX, Eye } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  sent: "bg-green-500/20 text-green-700 dark:text-green-400",
  failed: "bg-destructive/20 text-destructive",
};
const statusLabels: Record<string, string> = {
  pending: "Pendente", sent: "Enviado", failed: "Falhou",
};

export function EmailHistoryTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { sends, isLoading, stats, statsLoading } = useEmailSends({
    status: statusFilter && statusFilter !== "__all__" ? statusFilter : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const handleExportCSV = useCallback(() => {
    if (sends.length === 0) return;
    const headers = ["Destinatário", "Nome", "Template", "Campanha", "Status", "Data", "Erro"];
    const rows = sends.map((s: any) => [
      s.recipient_email,
      s.recipient_name || "",
      s.email_templates?.name || "",
      s.email_campaigns?.name || "",
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
      {/* Stats cards */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <MailCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Enviados</p>
                <p className="text-lg font-bold">{stats.sent}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <MailX className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="text-lg font-bold">{stats.failed}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <Eye className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Abertos</p>
                <p className="text-lg font-bold">{stats.opened}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <Mail className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Taxa Abertura</p>
                <p className="text-lg font-bold">{stats.openRate}%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter || "__all__"} onValueChange={(v) => { setStatusFilter(v === "__all__" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="failed">Falhas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={sends.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>

        <p className="text-xs text-muted-foreground ml-auto">Atualiza a cada 30s</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : sends.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum envio encontrado.</p>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aberto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sends.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm">{s.recipient_email}</p>
                        {s.recipient_name && <p className="text-xs text-muted-foreground">{s.recipient_name}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.email_templates?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{s.email_campaigns?.name || "—"}</TableCell>
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
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                      {s.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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
