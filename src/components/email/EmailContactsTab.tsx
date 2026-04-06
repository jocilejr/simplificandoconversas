import { useState } from "react";
import { useEmailContacts, ProcessedEmail } from "@/hooks/useEmailContacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Search, Users, Loader2, Wand2, CheckCircle2, AlertCircle, PenLine, Copy, AlertTriangle,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

const PREVIEW_LIMIT = 100;

export function EmailContactsTab() {
  const {
    contacts, loading, search, setSearch,
    addContact, deleteContact, processEmails, confirmBulkImport,
    activeCount, fixEmails, fixing,
    page, setPage, perPage, setPerPage, totalContacts, totalPages,
  } = useEmailContacts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");
  const [adding, setAdding] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState<ProcessedEmail[] | null>(null);
  const [importing, setImporting] = useState(false);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    await addContact(newEmail, newName || undefined, tags.length ? tags : undefined);
    setNewEmail("");
    setNewName("");
    setNewTags("");
    setAdding(false);
    setDialogOpen(false);
  };

  const handleProcess = async () => {
    if (!bulkText.trim()) return;
    setProcessing(true);
    const result = await processEmails(bulkText);
    setProcessed(result);
    setProcessing(false);
  };

  const handleConfirmImport = async () => {
    if (!processed) return;
    setImporting(true);
    await confirmBulkImport(processed);
    setImporting(false);
    setBulkOpen(false);
    setBulkText("");
    setProcessed(null);
  };

  const handleCancelBulk = () => {
    setBulkOpen(false);
    setBulkText("");
    setProcessed(null);
  };

  const statusIcon = (status: string) => {
    if (status === "valid") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    if (status === "corrected") return <PenLine className="h-3.5 w-3.5 text-yellow-500" />;
    if (status === "duplicate") return <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />;
    return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  };

  const validCount = processed?.filter((c) => c.status === "valid").length ?? 0;
  const correctedCount = processed?.filter((c) => c.status === "corrected").length ?? 0;
  const invalidCount = processed?.filter((c) => c.status === "invalid").length ?? 0;
  const duplicateCount = processed?.filter((c) => c.status === "duplicate").length ?? 0;
  const importableCount = validCount + correctedCount;

  const previewItems = processed ? processed.slice(0, PREVIEW_LIMIT) : [];
  const hasMoreItems = processed ? processed.length > PREVIEW_LIMIT : false;

  const sourceLabel: Record<string, string> = {
    manual: "Manual", import: "Importado", webhook: "Webhook",
  };

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-semibold text-foreground">
                Lista de E-mails
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {activeCount} ativos
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Importar e-mails
              </Button>
              <Button variant="outline" size="sm" onClick={fixEmails} disabled={fixing}>
                {fixing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                Corrigir e-mails
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar contato de e-mail</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div><Label>E-mail *</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="contato@exemplo.com" /></div>
                    <div><Label>Nome</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do contato" /></div>
                    <div><Label>Tags (separadas por vírgula)</Label><Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="lead, site, newsletter" /></div>
                    <Button onClick={handleAdd} disabled={adding || !newEmail.trim()} className="w-full">
                      {adding && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar contato
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search + Per Page selector */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Exibir:</span>
              <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
                <SelectTrigger className="w-[90px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="0">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum contato cadastrado</p>
              <p className="text-sm">Adicione manualmente ou importe uma lista de e-mails.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name || "—"}</TableCell>
                        <TableCell>{c.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.tags.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{sourceLabel[c.source] || c.source}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">
                            {c.status === "active" ? "Ativo" : "Descadastrado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteContact(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              {perPage > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">
                    {totalContacts} contato(s) — Página {page} de {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Próxima <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
              {perPage === 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {totalContacts} contato(s) exibidos
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkOpen} onOpenChange={(open) => { if (!open) handleCancelBulk(); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar e-mails</DialogTitle>
          </DialogHeader>

          {!processed ? (
            <div className="space-y-4">
              <div>
                <Label>Cole os e-mails abaixo (separados por vírgula, ponto-e-vírgula ou nova linha)</Label>
                <Textarea
                  className="mt-2 min-h-[200px] font-mono text-sm"
                  placeholder={"email1@gmail.com, email2@hotmail.com\nemail3@yahoo.com; email4@outlook.com"}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancelBulk}>Cancelar</Button>
                <Button onClick={handleProcess} disabled={processing || !bulkText.trim()}>
                  {processing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Processar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{validCount} válidos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <PenLine className="h-4 w-4 text-yellow-500" />
                  <span>{correctedCount} corrigidos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span>{duplicateCount} duplicados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>{invalidCount} inválidos</span>
                </div>
              </div>

              {hasMoreItems && (
                <p className="text-xs text-muted-foreground">
                  Mostrando {PREVIEW_LIMIT} de {processed.length} — os contadores acima refletem o total.
                </p>
              )}

              <div className="flex-1 overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Original</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewItems.map((p, i) => (
                      <TableRow key={i} className={p.status === "invalid" || p.status === "duplicate" ? "opacity-50" : ""}>
                        <TableCell>{statusIcon(p.status)}</TableCell>
                        <TableCell className="font-mono text-xs">{p.email}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.status === "corrected" ? <span className="line-through">{p.original}</span> : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.reason || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setProcessed(null)}>Voltar</Button>
                <Button onClick={handleConfirmImport} disabled={importing || importableCount === 0}>
                  {importing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Confirmar importação ({importableCount})
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
