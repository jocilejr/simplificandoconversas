import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome da Campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas grupos" />
            </div>
            <div>
              <Label>Instância</Label>
              <Select value={instanceName} onValueChange={setInstanceName}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.instance_name} value={inst.instance_name}>
                      {inst.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Group selection */}
          <div>
            <Label>Grupos-alvo ({groupJids.size} selecionados)</Label>
            <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 mt-1 space-y-1">
              {selectedGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Adicione grupos na aba "Grupos" primeiro.</p>
              ) : (
                selectedGroups.map((g) => (
                  <div key={g.group_jid} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                    <Checkbox
                      checked={groupJids.has(g.group_jid)}
                      onCheckedChange={() => toggleGroup(g.group_jid)}
                    />
                    <span className="text-sm">{g.group_name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{g.member_count} membros</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Messages (only for new campaigns) */}
          {!editData && (
            <GroupMessageEditor messages={messages} onChange={setMessages} />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending || !name || !instanceName}>
              {editData ? "Salvar" : "Criar Campanha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
