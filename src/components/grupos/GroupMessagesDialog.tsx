import { useState } from "react";
import {
  CalendarClock, Plus, Pencil, Trash2, MessageSquare, Image, Video, Mic,
  FileText, Sticker, MapPin, Contact, BarChart3, List, AtSign, ChevronDown,
  Clock, Eye, Settings2
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
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

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
  const [formOpen, setFormOpen] = useState(false);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [weekdayFilter, setWeekdayFilter] = useState<number | null>(null);

  const getPreview = (msg: any) => {
    const c = msg.content || {};
    if (msg.message_type === "text") return c.text || "Sem texto";
    if (msg.message_type === "poll") return c.question || "Enquete";
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
    return msg.content?.time || "";
  };

  const getScheduleDetail = (msg: any) => {
    if (msg.schedule_type === "once") return `Data: ${getTimeLabel(msg)}`;
    if (msg.schedule_type === "daily") return `Diário às ${msg.content?.time || "—"}`;
    if (msg.schedule_type === "weekly") {
      const days = (msg.content?.weekdays || []).map((d: number) => WEEKDAY_LABELS[d]).join(", ");
      return `${days} às ${msg.content?.time || "—"}`;
    }
    if (msg.schedule_type === "monthly") return `Dia ${msg.content?.monthDay || "—"} às ${msg.content?.time || "—"}`;
    if (msg.schedule_type === "custom") return `Dias ${msg.content?.customDays || "—"} às ${msg.content?.time || "—"}`;
    return msg.cron_expression || "";
  };

  const handleSave = async (data: any) => {
    if (editingMsg) {
      await updateMessage.mutateAsync({ msgId: editingMsg.id, ...data });
    } else {
      await createMessage.mutateAsync(data);
    }
    setFormOpen(false);
    setEditingMsg(null);
  };

  const handleAdd = () => {
    setEditingMsg(null);
    setFormOpen(true);
  };

  const handleEdit = (msg: any) => {
    setEditingMsg(msg);
    setFormOpen(true);
  };

  if (!campaign) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Programação — {campaign.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie as mensagens agendadas desta campanha.
            </DialogDescription>
          </DialogHeader>

          <div className="w-full min-w-0">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setExpandedId(null); setWeekdayFilter(null); }}>
              <TabsList className="w-full flex flex-wrap gap-1 h-auto p-1">
                {SCHEDULE_TABS.map(t => {
                  const count = messages.filter((m: any) => m.schedule_type === t.value).length;
                  return (
                    <TabsTrigger key={t.value} value={t.value} className="text-xs flex-1 min-w-[60px]">
                      {t.label}
                      {count > 0 && (
                        <Badge variant="secondary" className="ml-1.5 h-4 text-[9px] px-1">{count}</Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {SCHEDULE_TABS.map(tab => {
                const tabMessages = messages.filter((m: any) => m.schedule_type === tab.value);
                let displayMessages = tabMessages;
                if (tab.value === "weekly" && weekdayFilter !== null) {
                  displayMessages = tabMessages.filter((m: any) =>
                    (m.content?.weekdays || []).includes(weekdayFilter)
                  );
                }
                return (
                  <TabsContent key={tab.value} value={tab.value} className="space-y-3 mt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{tab.desc}</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAdd}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    </div>

                    {tab.value === "weekly" && (
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setWeekdayFilter(null)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                            weekdayFilter === null
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          Todos
                        </button>
                        {WEEKDAY_LABELS.map((label, idx) => (
                          <button
                            key={idx}
                            onClick={() => setWeekdayFilter(weekdayFilter === idx ? null : idx)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                              weekdayFilter === idx
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-primary/30"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {displayMessages.length === 0 && (
                      <div className="border border-dashed border-border rounded-xl p-10 text-center">
                        <CalendarClock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground/60">Nenhuma mensagem {tab.label.toLowerCase()} configurada.</p>
                      </div>
                    )}

                    {displayMessages.map((msg: any) => {
                      const Icon = TYPE_ICONS[msg.message_type] || MessageSquare;
                      const hasMention = msg.content?.mentionAll;
                      const isExpanded = expandedId === msg.id;

                      return (
                        <Collapsible key={msg.id} open={isExpanded} onOpenChange={(o) => setExpandedId(o ? msg.id : null)}>
                          <div className="border border-border rounded-xl bg-card overflow-hidden transition-colors hover:border-primary/20">
                            {/* Collapsed header */}
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center gap-3 p-3 cursor-pointer select-none">
                                <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 border border-border">
                                  <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                                      {TYPE_LABELS[msg.message_type] || msg.message_type}
                                    </Badge>
                                    {hasMention && (
                                      <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary gap-0.5 shrink-0">
                                        <AtSign className="h-2.5 w-2.5" /> todos
                                      </Badge>
                                    )}
                                    {tab.value === "weekly" && msg.content?.weekdays && (
                                      <div className="flex gap-0.5">
                                        {msg.content.weekdays.map((d: number) => (
                                          <span key={d} className="text-[9px] bg-primary/10 text-primary rounded px-1 py-0.5 font-medium">
                                            {WEEKDAY_LABELS[d]}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {getTimeLabel(msg) && (
                                      <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20 shrink-0 gap-1">
                                        <Clock className="h-2.5 w-2.5" />
                                        {getTimeLabel(msg)}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{getPreview(msg).slice(0, 80)}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Switch
                                    checked={msg.is_active}
                                    onCheckedChange={(e) => { e; toggleMessage.mutate(msg.id); }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="scale-75"
                                  />
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            {/* Expanded content */}
                            <CollapsibleContent>
                              <div className="border-t border-border">
                                <Tabs defaultValue="content" className="w-full">
                                  <TabsList className="w-full h-8 rounded-none bg-secondary/40 border-b border-border">
                                    <TabsTrigger value="content" className="text-[11px] h-7 gap-1">
                                      <Eye className="h-3 w-3" /> Conteúdo
                                    </TabsTrigger>
                                    <TabsTrigger value="schedule" className="text-[11px] h-7 gap-1">
                                      <Settings2 className="h-3 w-3" /> Programação
                                    </TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="content" className="p-4 m-0">
                                    <div className="text-sm text-foreground whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                                      {msg.message_type === "text" && (msg.content?.text || "Sem texto")}
                                      {msg.message_type === "poll" && (
                                        <div className="space-y-1">
                                          <p className="font-medium">{msg.content?.question}</p>
                                          {(msg.content?.options || []).map((o: string, i: number) => (
                                            <p key={i} className="text-muted-foreground">• {o}</p>
                                          ))}
                                        </div>
                                      )}
                                      {msg.message_type === "contact" && (
                                        <p>{msg.content?.contactName} — {msg.content?.contactPhone}</p>
                                      )}
                                      {msg.message_type === "location" && (
                                        <p>{msg.content?.name} ({msg.content?.latitude}, {msg.content?.longitude})</p>
                                      )}
                                      {msg.message_type === "list" && (
                                        <div>
                                          <p className="font-medium">{msg.content?.title}</p>
                                          <p className="text-muted-foreground">{msg.content?.description}</p>
                                        </div>
                                      )}
                                      {["image", "video", "audio", "document", "sticker"].includes(msg.message_type) && (
                                        <div className="space-y-1">
                                          {msg.content?.mediaUrl && (
                                            <p className="text-xs text-muted-foreground break-all">{msg.content.mediaUrl}</p>
                                          )}
                                          {msg.content?.caption && <p>{msg.content.caption}</p>}
                                        </div>
                                      )}
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="schedule" className="p-4 m-0">
                                    <div className="text-sm space-y-1">
                                      <p className="text-muted-foreground">{getScheduleDetail(msg)}</p>
                                      {msg.cron_expression && (
                                        <p className="text-[11px] text-muted-foreground/60 font-mono">cron: {msg.cron_expression}</p>
                                      )}
                                    </div>
                                  </TabsContent>
                                </Tabs>

                                {/* Action bar */}
                                <div className="flex items-center justify-end gap-1.5 p-3 border-t border-border bg-secondary/20">
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleEdit(msg)}>
                                    <Pencil className="h-3 w-3" /> Editar
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                                        <Trash2 className="h-3 w-3" /> Excluir
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
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form as separate popup dialog */}
      <GroupScheduledMessageForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingMsg(null); }}
        scheduleType={activeTab}
        editData={editingMsg}
        onSave={handleSave}
        isPending={createMessage.isPending || updateMessage.isPending}
      />
    </>
  );
}
