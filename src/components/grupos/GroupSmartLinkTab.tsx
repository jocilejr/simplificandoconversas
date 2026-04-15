import { useState, useMemo, useEffect } from "react";
import { Link2, Copy, RefreshCw, Users, MousePointerClick, CheckCircle2, XCircle, Trash2, Search, Plus, ArrowLeft, AlertTriangle, ExternalLink, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

  if (isLoading) return (
    <div className="space-y-4">
      <div className="flex justify-end"><Skeleton className="h-9 w-40" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setView("create")}>
          <Plus className="h-4 w-4 mr-1" /> Novo Smart Link
        </Button>
      </div>

      {smartLinks.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
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

function SmartLinkCard({ smartLink, onClick }: { smartLink: SmartLink; onClick: () => void }) {
  const stats = useSmartLinkStats(smartLink.id);
  return (
    <Card className="cursor-pointer hover:border-primary/40 border-border/50 transition-colors" onClick={onClick}>
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
          <Badge variant="outline" className="text-xs border-border/50">{smartLink.instance_name}</Badge>
        )}
      </CardContent>
    </Card>
  );
}

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
    <div className="space-y-4 max-w-2xl">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Criar Smart Link</p>
          </div>
          <div className="p-5 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Selecione a instância</Label>
              <div className="flex gap-2">
                <Select value={instanceName} onValueChange={setInstanceName}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {instances.map((inst: any) => (
                      <SelectItem key={inst.instance_name} value={inst.instance_name}>{inst.instance_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleFetchGroups} disabled={!instanceName || fetching} className="border-border/50">
                  <Search className={`h-4 w-4 mr-1 ${fetching ? "animate-spin" : ""}`} /> Buscar Grupos
                </Button>
              </div>
            </div>

            {fetchedGroups.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">{selectedJids.size} grupo(s) selecionado(s)</Label>
                <div className="rounded-md border border-border/50 max-h-60 overflow-y-auto">
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
                    <Label className="text-xs">Slug do link</Label>
                    <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="meu-grupo" />
                    <p className="text-xs text-muted-foreground">{window.location.origin}/r/g/{slug || "..."}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Máx. membros/grupo</Label>
                    <Input type="number" value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} min={1} />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={createSmartLink.isPending} className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> Criar Smart Link
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
      .filter(g => g.invite_url && (g as any).status !== "banned" && (g.member_count || 0) < maxMembersLimit)
      .sort((a, b) => (a.member_count || 0) - (b.member_count || 0));
    return available[0]?.group_jid || null;
  }, [groupLinks, maxMembersLimit]);

  const totalClicks = stats?.totalClicks || 0;
  const byGroup: Record<string, number> = stats?.byGroup || {};
  const publicUrl = `${window.location.origin}/r/g/${smartLink.slug}`;

  const handleCopy = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: `${label} copiada!` });
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

      {/* URLs */}
      <Card className="border-border/50">
        <CardContent className="p-0 divide-y divide-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">URL Pública (redirect)</p>
              <code className="text-sm truncate block">{publicUrl}</code>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleCopy(publicUrl, "URL")} className="shrink-0 border-border/50">
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
            </Button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">URL GET (retorna link como texto)</p>
              <code className="text-sm truncate block">{publicUrl}-get</code>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleCopy(`${publicUrl}-get`, "URL GET")} className="shrink-0 border-border/50">
              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync error */}
      {(smartLink as any).last_sync_error && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm">
            {((smartLink as any).last_sync_error as string).includes("desconectada")
              ? <>A instância <strong>{smartLink.instance_name}</strong> está desconectada. O sistema está usando fallback round-robin com os links existentes.</>
              : <>Problema na sincronização: {(smartLink as any).last_sync_error}</>
            }
            {(smartLink as any).last_sync_error_at && (
              <span className="text-xs text-muted-foreground ml-1">
                (último erro: {new Date((smartLink as any).last_sync_error_at).toLocaleString("pt-BR")})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 flex items-center gap-3">
            <MousePointerClick className="h-5 w-5 text-primary" />
            <div><p className="text-lg font-bold">{totalClicks}</p><p className="text-xs text-muted-foreground">Cliques totais</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div><p className="text-lg font-bold">{groupLinks.length}</p><p className="text-xs text-muted-foreground">Grupos vinculados</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 flex items-center gap-3">
            <Badge variant="outline" className="text-xs border-border/50">{smartLink.instance_name || "—"}</Badge>
            <div><p className="text-xs text-muted-foreground">Instância</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Edit */}
      {editing && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Slug</Label>
                <Input value={editSlug} onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Máx. membros/grupo</Label>
                <Input type="number" value={editMaxMembers} onChange={e => setEditMaxMembers(Number(e.target.value))} min={1} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={updateSmartLink.isPending}>Salvar</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups Table */}
      {groupLinks.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Grupos</p>
              <Button size="sm" variant="outline" onClick={() => syncInviteLinks.mutate(smartLink.id)} disabled={syncInviteLinks.isPending} className="text-xs border-border/50 h-7">
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncInviteLinks.isPending ? "animate-spin" : ""}`} /> Sincronizar
              </Button>
            </div>
            <div className="overflow-hidden">
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
                    const isBanned = (gl as any).status === "banned";
                    const isFull = !isBanned && (gl.member_count || 0) >= maxMembersLimit;
                    const isActive = gl.group_jid === activeGroupJid;
                    return (
                      <TableRow key={gl.group_jid} className={isBanned ? "opacity-60" : isActive ? "bg-primary/5" : ""}>
                        <TableCell className="text-sm truncate max-w-[200px]">{gl.group_name || gl.group_jid}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={isFull ? "destructive" : "secondary"} className="text-xs">{gl.member_count || 0}/{maxMembersLimit}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{byGroup[gl.group_jid] || 0}</TableCell>
                        <TableCell className="text-center">
                          {isBanned ? <XCircle className="h-4 w-4 text-destructive mx-auto" />
                            : gl.invite_url ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {isBanned ? <Badge variant="destructive" className="text-xs">Banido</Badge>
                            : isActive ? <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>
                            : isFull ? <Badge variant="destructive" className="text-xs">Lotado</Badge>
                            : <span className="text-xs text-muted-foreground">Espera</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
        {!editing && <Button variant="outline" size="sm" className="border-border/50" onClick={startEdit}>Editar configuração</Button>}
      </div>
    </div>
  );
}
