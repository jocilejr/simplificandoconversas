import { useState } from "react";
import { useEmailSends } from "@/hooks/useEmailSends";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  sent: "bg-green-500/20 text-green-700 dark:text-green-400",
  failed: "bg-destructive/20 text-destructive",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
};

export function EmailHistoryTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { sends, isLoading } = useEmailSends({
    status: statusFilter && statusFilter !== "__all__" ? statusFilter : undefined,
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
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
        <p className="text-xs text-muted-foreground">Atualiza automaticamente a cada 30s</p>
      </div>

      {sends.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum envio encontrado.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destinatário</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
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
      )}
    </div>
  );
}
