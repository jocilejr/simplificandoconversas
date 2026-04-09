import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Upload, Tag, ChevronLeft, ChevronRight, Users, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useLeads } from "@/hooks/useLeads";
import { LeadDetailDialog } from "@/components/leads/LeadDetailDialog";
import type { Lead } from "@/hooks/useLeads";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const formatPhone = (jid: string, phone?: string | null) => {
  return (phone || jid).replace("@s.whatsapp.net", "").replace(/\D/g, "");
};

type SortField = "name" | "phone" | "orders" | "total" | "reminders" | "status";
type SortDir = "asc" | "desc";

const Leads = () => {
  const {
    leads, allLeads, totalLeads, isLoading, search, setSearch,
    tagFilter, setTagFilter, uniqueTags,
    paymentFilter, setPaymentFilter,
    page, setPage, totalPages, counts,
    sortField, sortDir, handleSort,
    createContact, importCSV,
  } = useLeads();

  const [newOpen, setNewOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", instance_name: "" });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleCreate = () => {
    if (!form.phone.trim()) return;
    createContact.mutate(form, {
      onSuccess: () => { setNewOpen(false); setForm({ name: "", phone: "", instance_name: "" }); },
    });
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(/[;,]/);
        return { name: cols[0]?.trim() || "", phone: cols[1]?.trim() || "" };
      }).filter((r) => r.phone);
      if (rows.length === 0) return;
      importCSV.mutate(rows, { onSuccess: () => setCsvOpen(false) });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">{totalLeads} lead{totalLeads !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Importar CSV
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Search + Tag Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={tagFilter ? "default" : "outline"} size="icon">
              <Tag className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="space-y-2">
              <p className="text-sm font-medium">Filtrar por tag</p>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setTagFilter(null); setPage(1); }}>
                Todas
              </Button>
              {uniqueTags.map((t) => (
                <Button key={t} variant={tagFilter === t ? "secondary" : "ghost"} size="sm" className="w-full justify-start" onClick={() => { setTagFilter(t); setPage(1); }}>
                  {t}
                </Button>
              ))}
              {uniqueTags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag encontrada</p>}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {tagFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtro:</span>
          <Badge variant="secondary" className="cursor-pointer" onClick={() => { setTagFilter(null); setPage(1); }}>
            {tagFilter} ✕
          </Badge>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v as any); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
          <TabsTrigger value="paid">Pagaram ({counts.paid})</TabsTrigger>
          <TabsTrigger value="unpaid">Não Pagaram ({counts.unpaid})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-12">Carregando...</div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Users className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search || tagFilter ? "Nenhum lead encontrado com esses filtros." : "Nenhum lead cadastrado ainda."}
          </p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                  <span className="flex items-center">Nome <SortIcon field="name" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("phone")}>
                  <span className="flex items-center">Telefone <SortIcon field="phone" /></span>
                </TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("orders")}>
                  <span className="flex items-center justify-center">Pedidos <SortIcon field="orders" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("total")}>
                  <span className="flex items-center justify-end">Total Pago <SortIcon field="total" /></span>
                </TableHead>
                <TableHead className="hidden md:table-cell text-center cursor-pointer select-none" onClick={() => handleSort("reminders")}>
                  <span className="flex items-center justify-center">Agend. <SortIcon field="reminders" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                  <span className="flex items-center">Status <SortIcon field="status" /></span>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLeads.map((l) => (
                <TableRow
                  key={l.remote_jid}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedLead(l)}
                >
                  <TableCell className="font-medium max-w-[160px] truncate">
                    {l.contact_name || "Sem nome"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {formatPhone(l.remote_jid, l.phone_number)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs max-w-[180px] truncate">
                    {l.customer_email || "—"}
                  </TableCell>
                  <TableCell className="text-center">{l.paidOrdersCount}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {l.totalPaid > 0 ? formatCurrency(l.totalPaid) : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center">{l.remindersCount}</TableCell>
                  <TableCell>
                    {l.hasPaid ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]" variant="outline">
                        ✅ Pagou
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        ❌ Não pagou
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {l.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
                          {t}
                        </Badge>
                      ))}
                      {l.tags.length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{l.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* New Lead Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
            <DialogDescription>Adicione um lead manualmente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do lead" />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5511999999999" />
            </div>
            <div className="space-y-2">
              <Label>Instância</Label>
              <Input value={form.instance_name} onChange={(e) => setForm({ ...form, instance_name: e.target.value })} placeholder="Nome da instância (opcional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.phone.trim() || createContact.isPending}>
              {createContact.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar CSV</DialogTitle>
            <DialogDescription>
              O arquivo deve ter colunas <strong>nome</strong> e <strong>telefone</strong>, separadas por vírgula ou ponto-e-vírgula.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={importCSV.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {importCSV.isPending ? "Importando..." : "Selecionar arquivo CSV"}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadDetailDialog lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
};

export default Leads;
