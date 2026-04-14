import { useState } from "react";
import { CalendarClock, Plus, Pencil, Trash2, MessageSquare, Image, Video, Mic, FileText, Sticker, MapPin, Contact, BarChart3, List, AtSign } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useGroupScheduledMessages } from "@/hooks/useGroupScheduledMessages";
import GroupScheduledMessageForm from "./GroupScheduledMessageForm";

const TYPE_ICONS: Record<string, any> = {
  text: MessageSquare, image: Image, video: Video, audio: Mic,
  document: FileText, sticker: Sticker, location: MapPin,
  contact: Contact, poll: BarChart3, list: List,
};

const TYPE_LABELS: Record<string, string> = {
  text: "Texto", image: "Imagem", video: "Vídeo", audio: "Áudio",
  document: "Documento", sticker: "Figurinha", location: "Local",
  contact: "Contato", poll: "Enquete", list: "Lista",
};

const SCHEDULE_TABS = [
  { value: "once", label: "Único", desc: "Envio único em data e hora específica" },
  { value: "daily", label: "Diário", desc: "Repete todos os dias no horário definido" },
  { value: "weekly", label: "Semanal", desc: "Repete nos dias da semana selecionados" },
  { value: "monthly", label: "Mensal", desc: "Repete em um dia específico do mês" },
  { value: "custom", label: "Avançado", desc: "Dias personalizados do mês" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: any;
}

export default function GroupMessagesDialog({ open, onOpenChange, campaign }: Props) {
  const { messages, isLoading, createMessage, updateMessage, deleteMessage, toggleMessage } = useGroupScheduledMessages(campaign?.id || null);
  const [activeTab, setActiveTab] = useState("once");
  const [showForm, setShowForm] = useState(false);
  const [editMsg, setEditMsg] = useState<any>(null);

  

  const getPreview = (msg: any) => {
    const c = msg.content || {};
    if (msg.message_type === "text") return c.text?.slice(0, 80) || "Sem texto";
    if (msg.message_type === "poll") return c.question?.slice(0, 80) || "Enquete";
    if (msg.message_type === "contact") return c.contactName || "Contato";
    if (msg.message_type === "location") return c.name || "Localização";
    if (msg.message_type === "list") return c.title || "Lista";
    return c.caption || c.mediaUrl?.split("/").pop() || TYPE_LABELS[msg.message_type] || "Mídia";
  };

  const getTimeLabel = (msg: any) => {
    if (msg.schedule_type === "once" && msg.scheduled_at) {
      const d = new Date(msg.scheduled_at);
      return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return msg.content?.time || msg.cron_expression || "";
  };

  const handleSave = async (data: any) => {
    if (editMsg) {
      await updateMessage.mutateAsync({ msgId: editMsg.id, ...data });
    } else {
      await createMessage.mutateAsync(data);
    }
    setShowForm(false);
    setEditMsg(null);
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Programação — {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Gerencie as mensagens agendadas desta campanha.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setShowForm(false); setEditMsg(null); }}>
          <TabsList className="w-full grid grid-cols-5">
            {SCHEDULE_TABS.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">
                {t.label}
                {messages.filter((m: any) => m.schedule_type === t.value).length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 text-[9px] px-1">
                    {messages.filter((m: any) => m.schedule_type === t.value).length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {SCHEDULE_TABS.map(tab => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{tab.desc}</p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditMsg(null); setShowForm(true); }}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>

              {filteredMessages.length === 0 && !showForm && (
                <div className="border border-dashed border-border rounded-xl p-10 text-center">
                  <CalendarClock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/60">Nenhuma mensagem {tab.label.toLowerCase()} configurada.</p>
                </div>
              )}

              {filteredMessages.map((msg: any) => {
                const Icon = TYPE_ICONS[msg.message_type] || MessageSquare;
                const hasMention = msg.content?.mentionAll;
                return (
                  <div key={msg.id} className="flex items-center gap-3 p-3 border border-border rounded-xl bg-card hover:bg-secondary/40 transition-colors group">
                    <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 border border-border">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-5">
                          {TYPE_LABELS[msg.message_type] || msg.message_type}
                        </Badge>
                        {hasMention && (
                          <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary gap-0.5">
                            <AtSign className="h-2.5 w-2.5" /> todos
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">{getTimeLabel(msg)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{getPreview(msg)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={msg.is_active}
                        onCheckedChange={() => toggleMessage.mutate(msg.id)}
                        className="scale-75"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditMsg(msg); setShowForm(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
                            <AlertDialogDescription>Esta mensagem agendada será removida permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMessage.mutate(msg.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}

              {showForm && (
                <GroupScheduledMessageForm
                  scheduleType={activeTab}
                  editData={editMsg}
                  onSave={handleSave}
                  onCancel={() => { setShowForm(false); setEditMsg(null); }}
                  isPending={createMessage.isPending || updateMessage.isPending}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
