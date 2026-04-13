import { useState, useMemo } from "react";
import { Link2, Copy, RefreshCw, Users, MousePointerClick, CheckCircle2, XCircle, Trash2, Search, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useGroupSmartLinks, useSmartLinkStats, type GroupLink, type SmartLink } from "@/hooks/useGroupSmartLinks";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { apiUrl } from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";

interface FetchedGroup {
  jid: string;
  name: string;
  memberCount: number;
}

export default function GroupSmartLinkTab() {
  const [view, setView] = useState<"list" | "create" | string>("list");
  const { smartLinks, isLoading, createSmartLink, updateSmartLink, deleteSmartLink, syncInviteLinks } = useGroupSmartLinks();

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Carregando...</div>;

  if (view === "create") {
    return <CreateForm onBack={() => setView("list")} onCreated={() => setView("list")} createSmartLink={createSmartLink} />;
  }

  if (view !== "list") {
    const sl = smartLinks.find(s => s.id === view);
    if (!sl) { setView("list"); return null; }
    return (
      <SmartLinkDetail
        smartLink={sl}
        onBack={() => setView("list")}
        updateSmartLink={updateSmartLink}
        deleteSmartLink={deleteSmartLink}
        syncInviteLinks={syncInviteLinks}
        onDeleted={() => setView("list")}
      />
    );
  }

  // ─── List view ───
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Smart Links</h3>
          <p className="text-xs text-muted-foreground">Links inteligentes que distribuem leads entre grupos WhatsApp</p>
        </div>
        <Button size="sm" onClick={() => setView("create")}>
          <Plus className="h-4 w-4 mr-1" /> Novo Smart Link
        </Button>
      </div>

      {smartLinks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum Smart Link criado ainda.</p>
            <Button size="sm" className="mt-3" onClick={() => setView("create")}>
              <Plus className="h-4 w-4 mr-1" /> Criar primeiro Smart Link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {smartLinks.map(sl => (
            <SmartLinkCard key={sl.id} smartLink={sl} onClick={() => setView(sl.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card Component ───
function SmartLinkCard({ smartLink, onClick }: { smartLink: SmartLink; onClick: () => void }) {
  const stats = useSmartLinkStats(smartLink.id);
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={onClick}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm truncate">/{smartLink.slug}</span>
          </div>
          <Badge variant={smartLink.is_active ? "default" : "secondary"} className="text-xs">
            {smartLink.is_active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {smartLink.group_links?.length || 0} grupos</span>
          <span className="flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5" /> {stats?.totalClicks || 0} cliques</span>
        </div>
        {smartLink.instance_name && (
          <Badge variant="outline" className="text-xs">{smartLink.instance_name}</Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Create Form ───
function CreateForm({ onBack, onCreated, createSmartLink }: { onBack: () => void; onCreated: () => void; createSmartLink: any }) {
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const { instances } = useWhatsAppInstances();
  const [instanceName, setInstanceName] = useState("");
  const [fetchedGroups, setFetchedGroups] = useState<FetchedGroup[]>([]);
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [slug, setSlug] = useState("");
  const [maxMembers, setMaxMembers] = useState(200);

  const handleFetchGroups = async () => {
    if (!instanceName || !workspaceId) return;
    setFetching(true);
    try {
      const resp = await fetch(apiUrl("groups/fetch-groups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, workspaceId }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const groups: FetchedGroup[] = await resp.json();
      setFetchedGroups(groups);
      setSelectedJids(new Set());
    } catch (err: any) {
      toast({ title: "Erro ao buscar grupos", description: err.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  const toggleGroup = (jid: string) => {
    setSelectedJids(prev => {
      const next = new Set(prev);
      next.has(jid) ? next.delete(jid) : next.add(jid);
      return next;
    });
  };

  const handleCreate = () => {
    if (!slug.trim()) { toast({ title: "Slug é obrigatório", variant: "destructive" }); return; }
    if (selectedJids.size === 0) { toast({ title: "Selecione ao menos um grupo", variant: "destructive" }); return; }
    const groupLinks: GroupLink[] = fetchedGroups
      .filter(g => selectedJids.has(g.jid))
      .map(g => ({ group_jid: g.jid, group_name: g.name, member_count: g.memberCount, invite_url: "" }));
    createSmartLink.mutate({ slug, maxMembersPerGroup: maxMembers, instanceName, groupLinks }, {
      onSuccess: () => onCreated(),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Criar Smart Link</h3>
          </div>

          <div className="space-y-1.5">
            <Label>1. Selecione a instância</Label>
            <div className="flex gap-2">
              <Select value={instanceName} onValueChange={setInstanceName}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {instances.map((inst: any) => (
                    <SelectItem key={inst.instance_name} value={inst.instance_name}>{inst.instance_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleFetchGroups} disabled={!instanceName || fetching}>
                <Search className={`h-4 w-4 mr-1 ${fetching ? "animate-spin" : ""}`} /> Buscar Grupos
              </Button>
            </div>
          </div>

          {fetchedGroups.length > 0 && (
            <div className="space-y-1.5">
              <Label>2. Selecione os grupos ({selectedJids.size} selecionados)</Label>
              <div className="rounded-md border max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead className="text-center w-24">Membros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fetchedGroups.map(g => (
                      <TableRow key={g.jid} className="cursor-pointer" onClick={() => toggleGroup(g.jid)}>
                        <TableCell><Checkbox checked={selectedJids.has(g.jid)} onCheckedChange={() => toggleGroup(g.jid)} /></TableCell>
                        <TableCell className="text-sm truncate max-w-[250px]">{g.name}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-xs">{g.memberCount}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {selectedJids.size > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>3. Slug do link</Label>
                  <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="meu-grupo" />
                  <p className="text-xs text-muted-foreground">{window.location.origin}/r/g/{slug || "..."}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Máx. membros/grupo</Label>
                  <Input type="number" value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} min={1} />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createSmartLink.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Criar Smart Link
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Detail View ───
function SmartLinkDetail({ smartLink, onBack, updateSmartLink, deleteSmartLink, syncInviteLinks, onDeleted }: {
  smartLink: SmartLink;
  onBack: () => void;
  updateSmartLink: any;
  deleteSmartLink: any;
  syncInviteLinks: any;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editSlug, setEditSlug] = useState("");
  const [editMaxMembers, setEditMaxMembers] = useState(200);

  const stats = useSmartLinkStats(smartLink.id);
  const groupLinks: GroupLink[] = smartLink.group_links || [];
  const maxMembersLimit = smartLink.max_members_per_group || 200;

  const activeGroupJid = useMemo(() => {
    const available = groupLinks
      .filter(g => g.invite_url && (g.member_count || 0) < maxMembersLimit)
      .sort((a, b) => (a.member_count || 0) - (b.member_count || 0));
    return available[0]?.group_jid || null;
  }, [groupLinks, maxMembersLimit]);

  const totalClicks = stats?.totalClicks || 0;
  const byGroup: Record<string, number> = stats?.byGroup || {};
  const publicUrl = `${window.location.origin}/r/g/${smartLink.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "URL copiada!" });
  };

  const startEdit = () => {
    setEditSlug(smartLink.slug);
    setEditMaxMembers(smartLink.max_members_per_group);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    updateSmartLink.mutate({ id: smartLink.id, slug: editSlug, maxMembersPerGroup: editMaxMembers });
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      {/* URL */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <code className="text-sm flex-1 truncate">{publicUrl}</code>
        <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-3">
          <MousePointerClick className="h-5 w-5 text-primary" />
          <div><p className="text-lg font-bold">{totalClicks}</p><p className="text-xs text-muted-foreground">Cliques totais</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div><p className="text-lg font-bold">{groupLinks.length}</p><p className="text-xs text-muted-foreground">Grupos vinculados</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <Badge variant="outline" className="text-xs">{smartLink.instance_name || "—"}</Badge>
          <div><p className="text-xs text-muted-foreground">Instância</p></div>
        </CardContent></Card>
      </div>

      {/* Edit */}
      {editing && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={editSlug} onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. membros/grupo</Label>
              <Input type="number" value={editMaxMembers} onChange={e => setEditMaxMembers(Number(e.target.value))} min={1} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit} disabled={updateSmartLink.isPending}>Salvar</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Groups Table */}
      {groupLinks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Grupos</Label>
            <Button size="sm" variant="outline" onClick={() => syncInviteLinks.mutate(smartLink.id)} disabled={syncInviteLinks.isPending} className="text-xs">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncInviteLinks.isPending ? "animate-spin" : ""}`} /> Sincronizar URLs
            </Button>
          </div>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-center w-24">Membros</TableHead>
                  <TableHead className="text-center w-20">Cliques</TableHead>
                  <TableHead className="text-center w-16">URL</TableHead>
                  <TableHead className="text-center w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupLinks.map(gl => {
                  const isFull = (gl.member_count || 0) >= maxMembersLimit;
                  const isActive = gl.group_jid === activeGroupJid;
                  return (
                    <TableRow key={gl.group_jid} className={isActive ? "bg-primary/5" : ""}>
                      <TableCell className="text-sm truncate max-w-[200px]">{gl.group_name || gl.group_jid}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={isFull ? "destructive" : "secondary"} className="text-xs">{gl.member_count || 0}/{maxMembersLimit}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{byGroup[gl.group_jid] || 0}</TableCell>
                      <TableCell className="text-center">
                        {gl.invite_url ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </TableCell>
                      <TableCell className="text-center">
                        {isActive ? <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">► Ativo</Badge>
                          : isFull ? <Badge variant="destructive" className="text-xs">Lotado</Badge>
                          : <span className="text-xs text-muted-foreground">Espera</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir Smart Link
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Smart Link?</AlertDialogTitle>
              <AlertDialogDescription>O link público parará de funcionar imediatamente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSmartLink.mutate(smartLink.id, { onSuccess: () => onDeleted() })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {!editing && <Button variant="outline" size="sm" onClick={startEdit}>Editar configuração</Button>}
      </div>
    </div>
  );
}
