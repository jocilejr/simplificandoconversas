import { useState } from "react";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useGroupSelected, RemoteGroup } from "@/hooks/useGroupSelected";

export default function GroupSelectorTab() {
  const { instances } = useWhatsAppInstances();
  const { selectedGroups, fetchGroups, addGroups, removeGroup } = useGroupSelected();
  const [selectedInstance, setSelectedInstance] = useState("");
  const [remoteGroups, setRemoteGroups] = useState<RemoteGroup[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const handleFetch = async () => {
    if (!selectedInstance) return;
    const result = await fetchGroups.mutateAsync(selectedInstance);
    setRemoteGroups(result);
    setChecked(new Set());
  };

  const handleAdd = async () => {
    const groups = remoteGroups.filter((g) => checked.has(g.jid));
    if (groups.length === 0) return;
    await addGroups.mutateAsync({ instanceName: selectedInstance, groups });
    setChecked(new Set());
    setRemoteGroups([]);
  };

  const toggleCheck = (jid: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const alreadySelectedJids = new Set(selectedGroups.map((g) => g.group_jid));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Buscar Grupos</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-3">
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger className="w-[280px] bg-background/50 border-border/50">
                <SelectValue placeholder="Selecione uma instância" />
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
            <Button size="sm" onClick={handleFetch} disabled={!selectedInstance || fetchGroups.isPending}>
              {fetchGroups.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Buscar
            </Button>
          </div>

          {remoteGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{remoteGroups.length} grupos encontrados</p>
                <Button size="sm" variant="outline" onClick={handleAdd} disabled={checked.size === 0 || addGroups.isPending}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar ({checked.size})
                </Button>
              </div>
              <div className="max-h-[360px] overflow-y-auto space-y-0.5 border border-border/50 rounded-md p-1.5 bg-background/30">
                {remoteGroups.map((g) => {
                  const already = alreadySelectedJids.has(g.jid);
                  return (
                    <div
                      key={g.jid}
                      className={`flex items-center gap-3 p-2 rounded hover:bg-muted/30 transition-colors ${already ? "opacity-40" : "cursor-pointer"}`}
                      onClick={() => !already && toggleCheck(g.jid)}
                    >
                      <Checkbox
                        checked={checked.has(g.jid)}
                        onCheckedChange={() => toggleCheck(g.jid)}
                        disabled={already}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">{g.memberCount}</Badge>
                      {already && <Badge variant="secondary" className="shrink-0 text-[10px]">Adicionado</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Monitorados</CardTitle>
            <Badge variant="secondary" className="text-xs">{selectedGroups.length}</Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          {selectedGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum grupo selecionado.</p>
          ) : (
            <div className="space-y-0.5">
              {selectedGroups.map((g) => (
                <div key={g.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/30 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{g.group_name}</p>
                    <p className="text-[11px] text-muted-foreground">{g.instance_name} · {g.member_count} membros</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => removeGroup.mutate(g.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
