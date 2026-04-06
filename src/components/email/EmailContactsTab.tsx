import { useState, useRef } from "react";
import { useEmailContacts, AnalyzedContact } from "@/hooks/useEmailContacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plus, Upload, Trash2, Search, Users, Loader2, Wand2, CheckCircle2, AlertCircle, PenLine,
} from "lucide-react";
import { format } from "date-fns";

export function EmailContactsTab() {
  const {
    contacts, loading, search, setSearch,
    addContact, deleteContact, analyzeCSV, confirmImport,
    activeCount, fixEmails, fixing,
  } = useEmailContacts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // CSV preview states
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedContacts, setAnalyzedContacts] = useState<AnalyzedContact[] | null>(null);
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

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    setCsvDialogOpen(true);
    setAnalyzing(true);
    setAnalyzedContacts(null);

    const result = await analyzeCSV(file);
    setAnalyzedContacts(result);
    setAnalyzing(false);

    if (!result) {
      setCsvDialogOpen(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!analyzedContacts) return;
    setImporting(true);
    await confirmImport(analyzedContacts);
    setImporting(false);
    setCsvDialogOpen(false);
    setAnalyzedContacts(null);
  };

  const handleCancelImport = () => {
    setCsvDialogOpen(false);
    setAnalyzedContacts(null);
  };

  const sourceLabel: Record<string, string> = {
    manual: "Manual", import: "Importado", webhook: "Webhook",
  };

  const statusIcon = (status: string) => {
    if (status === "valid") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    if (status === "corrected") return <PenLine className="h-3.5 w-3.5 text-yellow-500" />;
    return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  };

  const validCount = analyzedContacts?.filter((c) => c.status !== "invalid").length ?? 0;
  const correctedCount = analyzedContacts?.filter((c) => c.status === "corrected").length ?? 0;
  const invalidCount = analyzedContacts?.filter((c) => c.status === "invalid").length ?? 0;

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
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Importar arquivo
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
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum contato cadastrado</p>
              <p className="text-sm">Adicione manualmente, importe um CSV ou use o webhook.</p>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {/* CSV Preview Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={(open) => { if (!open) handleCancelImport(); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importação inteligente de CSV</DialogTitle>
          </DialogHeader>

          {analyzing ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando CSV...</p>
              <p className="text-xs text-muted-foreground">Identificando colunas e corrigindo e-mails</p>
            </div>
          ) : analyzedContacts ? (
            <>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{validCount - correctedCount} válidos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <PenLine className="h-4 w-4 text-yellow-500" />
                  <span>{correctedCount} corrigidos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>{invalidCount} ignorados</span>
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyzedContacts.map((c, i) => (
                      <TableRow key={i} className={c.status === "invalid" ? "opacity-50" : ""}>
                        <TableCell>{statusIcon(c.status)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.email}
                          {c.status === "corrected" && c.original_email && (
                            <span className="block text-[10px] text-muted-foreground line-through">{c.original_email}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{c.name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.tags?.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.reason || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCancelImport}>Cancelar</Button>
                <Button onClick={handleConfirmImport} disabled={importing || validCount === 0}>
                  {importing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Confirmar importação ({validCount})
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
