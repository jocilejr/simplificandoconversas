import { useState } from "react";
import { Plus, Play, Trash2, Pencil, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import GroupCampaignDialog from "./GroupCampaignDialog";
import { format } from "date-fns";

export default function GroupCampaignsTab() {
  const { campaigns, isLoading, updateCampaign, deleteCampaign, enqueueCampaign } = useGroupCampaigns();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<any>(null);

  const handleEdit = (c: any) => {
    setEditCampaign(c);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Campanhas de Grupo</h3>
        <Button onClick={() => { setEditCampaign(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Campanha
        </Button>
      </div>

      {campaigns.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">Nenhuma campanha criada. Clique em "Nova Campanha" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{c.name}</h4>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Instância: {c.instance_name}</span>
                      <span>Grupos: {c.group_jids?.length || 0}</span>
                      <span>Mensagens: {c.group_scheduled_messages?.length || 0}</span>
                      <span>Criada: {format(new Date(c.created_at), "dd/MM/yyyy")}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={c.is_active ? "Desativar" : "Ativar"}
                      onClick={() => updateCampaign.mutate({ id: c.id, isActive: !c.is_active })}
                    >
                      {c.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Enviar Agora"
                      onClick={() => enqueueCampaign.mutate(c.id)}
                    >
                      <Play className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteCampaign.mutate(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GroupCampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editData={editCampaign}
      />
    </div>
  );
}
