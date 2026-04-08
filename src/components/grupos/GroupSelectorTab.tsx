import { useState } from "react";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-6">
      {/* Instance selector + fetch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buscar Grupos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.instance_name} value={inst.instance_name}>
                    {inst.instance_name} {inst.status === "open" ? "🟢" : "🔴"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleFetch} disabled={!selectedInstance || fetchGroups.isPending}>
              {fetchGroups.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar Grupos
            </Button>
          </div>

          {remoteGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{remoteGroups.length} grupos encontrados</p>
                <Button size="sm" onClick={handleAdd} disabled={checked.size === 0 || addGroups.isPending}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar {checked.size} selecionados
                </Button>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-1 border rounded-md p-2">
                {remoteGroups.map((g) => {
                  const already = alreadySelectedJids.has(g.jid);
                  return (
                    <div
                      key={g.jid}
                      className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 ${already ? "opacity-50" : ""}`}
                    >
                      <Checkbox
                        checked={checked.has(g.jid)}
                        onCheckedChange={() => toggleCheck(g.jid)}
                        disabled={already}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{g.memberCount} membros</Badge>
                      {already && <Badge variant="secondary" className="shrink-0">Já adicionado</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Already selected groups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grupos Monitorados ({selectedGroups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum grupo selecionado ainda.</p>
          ) : (
            <div className="space-y-1">
              {selectedGroups.map((g) => (
                <div key={g.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{g.group_name}</p>
                    <p className="text-xs text-muted-foreground">{g.instance_name} · {g.member_count} membros</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive shrink-0"
                    onClick={() => removeGroup.mutate(g.id)}
                  >
                    <Trash2 className="h-4 w-4" />
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
