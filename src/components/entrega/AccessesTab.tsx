import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";

export function AccessesTab() {
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");

  const { data: products } = useQuery({
    queryKey: ["delivery-products-list", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_products")
        .select("id, name")
        .eq("workspace_id", workspaceId!)
        .order("name");
      return data || [];
    },
  });

  const { data: accesses, isLoading } = useQuery({
    queryKey: ["delivery-accesses", workspaceId, productFilter],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = supabase
        .from("delivery_accesses")
        .select("*, delivery_products(name)")
        .eq("workspace_id", workspaceId!)
        .order("accessed_at", { ascending: false })
        .limit(200);
      if (productFilter !== "all") q = q.eq("product_id", productFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = (accesses || []).filter((a) =>
    !search || (a.phone || "").includes(search)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acessos Registrados</CardTitle>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(products || []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum acesso registrado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Pixel</TableHead>
                <TableHead>Webhook</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{(a as any).delivery_products?.name || "-"}</TableCell>
                  <TableCell>{a.phone || "-"}</TableCell>
                  <TableCell>{format(new Date(a.accessed_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>
                    <Badge variant={a.pixel_fired ? "default" : "secondary"}>
                      {a.pixel_fired ? "Disparado" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.webhook_sent ? "default" : "secondary"}>
                      {a.webhook_sent ? "Enviado" : "Pendente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
