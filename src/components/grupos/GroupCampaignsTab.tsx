import { useState } from "react";
import { Plus, Pencil, Trash2, Play, Radio, Zap, ZapOff, Users, MessageSquare, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import GroupCampaignDialog from "./GroupCampaignDialog";
import GroupMessagesDialog from "./GroupMessagesDialog";
import { format } from "date-fns";

export default function GroupCampaignsTab() {
  const { campaigns, isLoading, updateCampaign, deleteCampaign, enqueueCampaign } = useGroupCampaigns();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<any>(null);
  const [messagesCampaign, setMessagesCampaign] = useState<any>(null);

  const handleEdit = (c: any) => {
    setEditCampaign(c);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Campanhas</h3>
          <p className="text-xs text-muted-foreground">{campaigns.length} campanha(s) criada(s)</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditCampaign(null); setDialogOpen(true); }}
          className="shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
        >
          <Plus className="h-4 w-4 mr-1" /> Nova Campanha
        </Button>
      </div>

      {campaigns.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Nova Campanha" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c: any) => (
            <Card key={c.id} className={`overflow-hidden transition-all ${c.is_active ? "shadow-[0_0_16px_hsl(var(--primary)/0.15)]" : ""}`}>
              <div className={`h-[2px] ${c.is_active ? "bg-gradient-to-r from-primary/80 via-primary to-primary/80" : "bg-border/50"}`} />
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm">{c.name}</h4>
                      <Badge variant="outline" className="gap-1 text-xs">
                        {c.is_active ? <Zap className="h-3 w-3 text-green-500" /> : <ZapOff className="h-3 w-3 text-muted-foreground" />}
                        {c.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Radio className="h-3 w-3" />
                        {c.instance_name}
                      </Badge>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.group_jids?.length || 0} grupos</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{c.group_scheduled_messages?.length || 0} msgs</span>
                      <span>{format(new Date(c.created_at), "dd/MM/yyyy")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={c.is_active} onCheckedChange={(checked) => updateCampaign.mutate({ id: c.id, isActive: checked })} />
                    <div className="flex gap-1 border-l border-border/50 pl-2 ml-1">
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 px-2.5" onClick={() => setMessagesCampaign(c)}>
                        <CalendarClock className="h-3.5 w-3.5" />
                        Programação
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                            <AlertDialogDescription>A campanha "{c.name}" e suas mensagens agendadas serão removidas permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCampaign.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GroupCampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} editData={editCampaign} />
      <GroupMessagesDialog open={!!messagesCampaign} onOpenChange={(v) => !v && setMessagesCampaign(null)} campaign={messagesCampaign} />
    </div>
  );
}
