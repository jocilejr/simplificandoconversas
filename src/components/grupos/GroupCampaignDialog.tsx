import { useState, useEffect, useRef } from "react";
import { Megaphone, Radio, Users, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface RemoteGroup {
  jid: string;
  name: string;
  memberCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
}

export default function GroupCampaignDialog({ open, onOpenChange, editData }: Props) {
  const { instances } = useWhatsAppInstances();
  const { createCampaign, updateCampaign } = useGroupCampaigns();
  const { workspaceId } = useWorkspace();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [groupJids, setGroupJids] = useState<Set<string>>(new Set());

  const [remoteGroups, setRemoteGroups] = useState<RemoteGroup[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const editInstanceRef = useRef("");

  useEffect(() => {
    if (editData) {
      setName(editData.name || "");
      setDescription(editData.description || "");
      setInstanceName(editData.instance_name || "");
      setGroupJids(new Set(editData.group_jids || []));
      editInstanceRef.current = editData.instance_name || "";
    } else {
      setName("");
      setDescription("");
      setInstanceName("");
      setGroupJids(new Set());
      editInstanceRef.current = "";
    }
    setRemoteGroups([]);
    setSearchFilter("");
  }, [editData, open]);

  // Auto-fetch groups when instance changes
  useEffect(() => {
    if (!instanceName || !workspaceId) {
      setRemoteGroups([]);
      return;
    }

    let cancelled = false;
    const fetchGroups = async () => {
      setFetchingGroups(true);
      try {
        const resp = await fetch(apiUrl("groups/fetch-groups"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceName, workspaceId }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        const groups: RemoteGroup[] = await resp.json();
        if (!cancelled) {
          setRemoteGroups(groups);
          setGroupJids(new Set());
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err.message || "";
          const description = msg.includes("403")
            ? "Instância não pertence a este workspace"
            : "Não foi possível validar os grupos da instância. Verifique a conexão.";
          toast({ title: "Erro ao buscar grupos", description, variant: "destructive" });
          setRemoteGroups([]);
        }
      } finally {
        if (!cancelled) setFetchingGroups(false);
      }
    };

    fetchGroups();
    return () => { cancelled = true; };
  }, [instanceName, workspaceId]);

  const toggleGroup = (jid: string) => {
    setGroupJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const selectAll = () => setGroupJids(new Set(filteredGroups.map(g => g.jid)));
  const deselectAll = () => setGroupJids(new Set());

  const filteredGroups = remoteGroups.filter(g =>
    !searchFilter || g.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleSave = async () => {
    if (!name || !instanceName) return;
    const jids = Array.from(groupJids);
    if (editData) {
      await updateCampaign.mutateAsync({ id: editData.id, name, description, instanceName, groupJids: jids });
    } else {
      await createCampaign.mutateAsync({ name, description, instanceName, groupJids: jids });
    }
    onOpenChange(false);
  };

  const isPending = createCampaign.isPending || updateCampaign.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            {editData ? "Editar Campanha" : "Nova Campanha"}
          </DialogTitle>
          <DialogDescription>
            Selecione a instância para carregar os grupos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Megaphone className="h-3 w-3 text-muted-foreground" />
                Nome
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas" className="bg-background/50 border-border/50 focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-muted-foreground" />
                Instância
              </Label>
              <Select value={instanceName} onValueChange={setInstanceName}>
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.instance_name} value={inst.instance_name}>
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${inst.status === "open" ? "bg-green-500" : "bg-red-500"}`} />
                        {inst.instance_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-background/50 border-border/50 focus:border-primary/50 resize-none" placeholder="Descreva o objetivo desta campanha..." />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Users className="h-3 w-3 text-muted-foreground" />
                Grupos-alvo
                <Badge variant="secondary" className="text-[10px] h-5">{groupJids.size}</Badge>
              </Label>
              {remoteGroups.length > 0 && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={selectAll}>Todos</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={deselectAll}>Nenhum</Button>
                </div>
              )}
            </div>

            {!instanceName ? (
              <div className="border border-border/50 rounded-md p-6 text-center bg-background/30">
                <Radio className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Selecione uma instância para carregar os grupos.</p>
              </div>
            ) : fetchingGroups ? (
              <div className="border border-border/50 rounded-md p-6 text-center bg-background/30">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Buscando grupos da instância...</p>
              </div>
            ) : remoteGroups.length === 0 ? (
              <div className="border border-border/50 rounded-md p-6 text-center bg-background/30">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum grupo ativo encontrado nesta instância.</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Apenas grupos onde você participa ativamente são listados. Verifique se a instância está conectada.</p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar grupos..."
                    className="pl-8 h-8 text-xs bg-background/50 border-border/50"
                  />
                </div>
                <div className="max-h-[220px] overflow-y-auto border border-border/50 rounded-md p-1.5 space-y-0.5 bg-background/30">
                  {filteredGroups.map((g) => (
                    <div
                      key={g.jid}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => toggleGroup(g.jid)}
                    >
                      <Checkbox checked={groupJids.has(g.jid)} onCheckedChange={() => toggleGroup(g.jid)} />
                      <span className="text-sm flex-1 truncate">{g.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{g.memberCount}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground text-right">
                  {filteredGroups.length} grupo(s) · {groupJids.size} selecionado(s)
                </p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={isPending || !name || !instanceName}>
              {editData ? "Salvar" : "Criar Campanha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
