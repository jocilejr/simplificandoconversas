import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ApiLog {
  id: string;
  method: string;
  path: string;
  status_code: number;
  request_body: any;
  response_summary: string | null;
  ip_address: string | null;
  created_at: string;
}

function StatusBadge({ code }: { code: number }) {
  const variant = code >= 500 ? "destructive" : code >= 400 ? "secondary" : "default";
  const className =
    code >= 500
      ? "bg-red-500/15 text-red-500 border-red-500/30"
      : code >= 400
        ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
        : "bg-green-500/15 text-green-500 border-green-500/30";

  return (
    <Badge variant="outline" className={className}>
      {code}
    </Badge>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "text-green-500",
    POST: "text-blue-500",
    PATCH: "text-yellow-500",
    PUT: "text-orange-500",
    DELETE: "text-red-500",
  };
  return <span className={`font-mono font-bold text-xs ${colors[method] || "text-foreground"}`}>{method}</span>;
}

export function ApiLogsPanel() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await (supabase as any)
        .from("api_request_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (queryError) {
        console.error("Error fetching API logs:", queryError);
        setError(queryError.message || "Erro ao buscar logs");
        setLogs([]);
      } else {
        setLogs(data || []);
      }
    } catch (err: any) {
      console.error("Error fetching API logs:", err);
      setError(err?.message || "Erro ao buscar logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Logs de Requisições</CardTitle>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center">
            <p className="text-sm font-medium text-destructive">Erro ao carregar logs</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Verifique se a tabela <code className="bg-muted px-1 rounded">api_request_logs</code> existe no banco de dados da VPS.
            </p>
          </div>
        ) : logs.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma requisição registrada ainda. As requisições feitas à API serão exibidas aqui.
          </p>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[150px]">Data/Hora</TableHead>
                  <TableHead className="w-[70px]">Método</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead>Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <Collapsible key={log.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : log.id)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer">
                            <TableCell className="px-2">
                              {log.request_body ? (
                                isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.created_at), "dd/MM HH:mm:ss")}
                            </TableCell>
                            <TableCell><MethodBadge method={log.method} /></TableCell>
                            <TableCell className="font-mono text-xs max-w-[200px] truncate">{log.path}</TableCell>
                            <TableCell><StatusBadge code={log.status_code} /></TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {log.response_summary || "—"}
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        {log.request_body && (
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30 px-6 py-3">
                                <div className="text-xs">
                                  <span className="font-medium text-muted-foreground">Request Body:</span>
                                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
                                    {JSON.stringify(log.request_body, null, 2)}
                                  </pre>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        )}
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Últimas 50 requisições • Atualiza automaticamente a cada 30s
        </p>
      </CardContent>
    </Card>
  );
}
