import { useState, useEffect } from "react";
import { Megaphone, Radio, Users } from "lucide-react";
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
import { useGroupSelected } from "@/hooks/useGroupSelected";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import GroupMessageEditor from "./GroupMessageEditor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
}

export default function GroupCampaignDialog({ open, onOpenChange, editData }: Props) {
  const { instances } = useWhatsAppInstances();
  const { selectedGroups } = useGroupSelected();
  const { createCampaign, updateCampaign } = useGroupCampaigns();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [groupJids, setGroupJids] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<any[]>([{ messageType: "text", content: { text: "" }, scheduleType: "once" }]);

  useEffect(() => {
    if (editData) {
      setName(editData.name || "");
      setDescription(editData.description || "");
      setInstanceName(editData.instance_name || "");
      setGroupJids(new Set(editData.group_jids || []));
    } else {
      setName("");
      setDescription("");
      setInstanceName("");
      setGroupJids(new Set());
      setMessages([{ messageType: "text", content: { text: "" }, scheduleType: "once" }]);
    }
  }, [editData, open]);

  const toggleGroup = (jid: string) => {
    setGroupJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const selectAll = () => {
    setGroupJids(new Set(selectedGroups.map(g => g.group_jid)));
  };

  const deselectAll = () => {
    setGroupJids(new Set());
  };

  const handleSave = async () => {
    if (!name || !instanceName) return;
    const jids = Array.from(groupJids);

    if (editData) {
      await updateCampaign.mutateAsync({ id: editData.id, name, description, instanceName, groupJids: jids });
    } else {
      await createCampaign.mutateAsync({ name, description, instanceName, groupJids: jids, messages });
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
            Configure os detalhes da campanha e selecione os grupos-alvo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Megaphone className="h-3 w-3 text-muted-foreground" />
                Nome
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Boas-vindas"
                className="bg-background/50 border-border/50 focus:border-primary/50"
              />
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
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-background/50 border-border/50 focus:border-primary/50 resize-none"
              placeholder="Descreva o objetivo desta campanha..."
            />
          </div>

          <Separator />

          {/* Group selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Users className="h-3 w-3 text-muted-foreground" />
                Grupos-alvo
                <Badge variant="secondary" className="text-[10px] h-5">{groupJids.size}</Badge>
              </Label>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={selectAll}>
                  Todos
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={deselectAll}>
                  Nenhum
                </Button>
              </div>
            </div>
            <div className="max-h-[180px] overflow-y-auto border border-border/50 rounded-md p-1.5 space-y-0.5 bg-background/30">
              {selectedGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Adicione grupos na aba "Seleção" primeiro.</p>
              ) : (
                selectedGroups.map((g) => (
                  <div
                    key={g.group_jid}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => toggleGroup(g.group_jid)}
                  >
                    <Checkbox
                      checked={groupJids.has(g.group_jid)}
                      onCheckedChange={() => toggleGroup(g.group_jid)}
                    />
                    <span className="text-sm flex-1 truncate">{g.group_name}</span>
                    <span className="text-[10px] text-muted-foreground">{g.member_count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* Messages (only for new campaigns) */}
          {!editData && (
            <GroupMessageEditor messages={messages} onChange={setMessages} />
          )}

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
