import { useState, useEffect } from "react";
import {
  MessageSquare, Image, Video, Mic, FileText, Sticker, MapPin, Contact, BarChart3, List,
  Clock, Save, Plus, Trash2, AtSign, Link2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import WhatsAppPreview from "./WhatsAppPreview";

const MESSAGE_TYPES = [
  { value: "text", label: "Texto", icon: MessageSquare },
  { value: "image", label: "Imagem", icon: Image },
  { value: "video", label: "Vídeo", icon: Video },
  { value: "audio", label: "Áudio", icon: Mic },
  { value: "document", label: "Documento", icon: FileText },
  { value: "sticker", label: "Figurinha", icon: Sticker },
  { value: "location", label: "Local", icon: MapPin },
  { value: "contact", label: "Contato", icon: Contact },
  { value: "poll", label: "Enquete", icon: BarChart3 },
  { value: "list", label: "Lista", icon: List },
];

const WEEKDAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const SUPPORTS_MENTION = ["text", "image", "video", "audio"];

const SCHEDULE_LABELS: Record<string, string> = {
  once: "Único", daily: "Diário", weekly: "Semanal", monthly: "Mensal", custom: "Avançado",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleType: string;
  editData?: any;
  onSave: (data: any) => void;
  isPending?: boolean;
}

function getDefaultContent(type: string) {
  switch (type) {
    case "text": return { text: "" };
    case "contact": return { contactName: "", contactPhone: "" };
    case "location": return { latitude: "", longitude: "", name: "", address: "" };
    case "poll": return { question: "", options: ["", ""], selectableCount: 1 };
    case "list": return { title: "", description: "", buttonText: "Ver opções", footer: "", sections: [] };
    default: return { mediaUrl: "", caption: "" };
  }
}

export default function GroupScheduledMessageForm({ open, onOpenChange, scheduleType, editData, onSave, isPending }: Props) {
  const [messageType, setMessageType] = useState("text");
  const [content, setContent] = useState<any>({ text: "" });
  const [scheduledAt, setScheduledAt] = useState("");
  const [timeValue, setTimeValue] = useState("09:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [monthDay, setMonthDay] = useState(1);
  const [customDays, setCustomDays] = useState("");
  const [mentionAll, setMentionAll] = useState(false);
  const [forceLinkPreview, setForceLinkPreview] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setMessageType(editData.message_type || "text");
      setContent(editData.content || { text: "" });
      setMentionAll(editData.content?.mentionAll || false);
      setForceLinkPreview(editData.content?.forceLinkPreview !== false);
      if (editData.scheduled_at) {
        const d = new Date(editData.scheduled_at);
        setScheduledAt(d.toISOString().slice(0, 10));
        setTimeValue(d.toISOString().slice(11, 16));
      }
      if (editData.content?.weekdays) setWeekdays(editData.content.weekdays);
      if (editData.content?.monthDay) setMonthDay(editData.content.monthDay);
      if (editData.content?.customDays) setCustomDays(editData.content.customDays);
      if (editData.content?.time) setTimeValue(editData.content.time);
    } else {
      setMessageType("text");
      setContent({ text: "" });
      setScheduledAt("");
      setTimeValue("09:00");
      setWeekdays([1, 2, 3, 4, 5]);
      setMonthDay(1);
      setCustomDays("");
      setMentionAll(false);
      setForceLinkPreview(true);
    }
  }, [open, editData]);

  const toggleWeekday = (d: number) => {
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const handleSubmit = () => {
    const finalContent = { ...content, mentionAll, forceLinkPreview };
    let scheduled_at: string | null = null;
    let cron_expression: string | null = null;
    let interval_minutes: number | null = null;

    if (scheduleType === "once" && scheduledAt) {
      scheduled_at = new Date(`${scheduledAt}T${timeValue}:00-03:00`).toISOString();
    }
    if (scheduleType === "daily") {
      const [h, m] = timeValue.split(":");
      cron_expression = `${m} ${h} * * *`;
      finalContent.time = timeValue;
    }
    if (scheduleType === "weekly") {
      const [h, m] = timeValue.split(":");
      cron_expression = `${m} ${h} * * ${weekdays.join(",")}`;
      finalContent.weekdays = weekdays;
      finalContent.time = timeValue;
    }
    if (scheduleType === "monthly") {
      const [h, m] = timeValue.split(":");
      cron_expression = `${m} ${h} ${monthDay} * *`;
      finalContent.monthDay = monthDay;
      finalContent.time = timeValue;
    }
    if (scheduleType === "custom") {
      finalContent.customDays = customDays;
      finalContent.time = timeValue;
      const [h, m] = timeValue.split(":");
      cron_expression = `${m} ${h} ${customDays} * *`;
    }

    onSave({
      messageType,
      content: finalContent,
      scheduleType,
      scheduledAt: scheduled_at,
      cronExpression: cron_expression,
      intervalMinutes: interval_minutes,
    });
  };

  const inputClasses = "h-9 text-sm bg-secondary border-border placeholder:text-muted-foreground/50 focus:border-primary/50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {editData ? "Editar" : "Nova"} mensagem — {SCHEDULE_LABELS[scheduleType] || scheduleType}
          </DialogTitle>
          <DialogDescription>
            Configure o conteúdo e agendamento da mensagem.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Left: Form */}
          <div className="space-y-4">
            {/* Type grid */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Tipo de mensagem</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {MESSAGE_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setMessageType(t.value); setContent(getDefaultContent(t.value)); setMentionAll(false); }}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all duration-200",
                        messageType === t.value
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                          : "border-border bg-secondary/60 hover:border-primary/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content fields */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">Conteúdo</Label>

              {messageType === "text" && (
                <div className="space-y-3">
                  <Textarea
                    value={content?.text || ""}
                    onChange={(e) => setContent({ ...content, text: e.target.value })}
                    placeholder="Texto da mensagem... Use *negrito*, _itálico_, ~tachado~"
                    rows={5}
                    className="text-sm bg-secondary border-border resize-none placeholder:text-muted-foreground/50 focus:border-primary/50"
                  />
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch checked={mentionAll} onCheckedChange={setMentionAll} />
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                        <AtSign className="h-3 w-3" /> Mencionar todos
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={forceLinkPreview} onCheckedChange={setForceLinkPreview} />
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                        <Link2 className="h-3 w-3" /> Link Preview
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {["image", "video", "audio", "document", "sticker"].includes(messageType) && (
                <div className="space-y-3">
                  <Input value={content?.mediaUrl || ""} onChange={(e) => setContent({ ...content, mediaUrl: e.target.value })} placeholder="URL da mídia" className={inputClasses} />
                  {messageType !== "sticker" && messageType !== "audio" && (
                    <Input value={content?.caption || ""} onChange={(e) => setContent({ ...content, caption: e.target.value })} placeholder="Legenda (opcional)" className={inputClasses} />
                  )}
                  {SUPPORTS_MENTION.includes(messageType) && messageType !== "text" && (
                    <div className="flex items-center gap-2">
                      <Switch checked={mentionAll} onCheckedChange={setMentionAll} />
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                        <AtSign className="h-3 w-3" /> Mencionar todos
                      </Label>
                    </div>
                  )}
                </div>
              )}

              {messageType === "contact" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input value={content?.contactName || ""} onChange={(e) => setContent({ ...content, contactName: e.target.value })} placeholder="Nome do contato" className={inputClasses} />
                  <Input value={content?.contactPhone || ""} onChange={(e) => setContent({ ...content, contactPhone: e.target.value })} placeholder="Telefone" className={inputClasses} />
                </div>
              )}

              {messageType === "location" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input value={content?.latitude || ""} onChange={(e) => setContent({ ...content, latitude: e.target.value })} placeholder="Latitude" className={inputClasses} />
                  <Input value={content?.longitude || ""} onChange={(e) => setContent({ ...content, longitude: e.target.value })} placeholder="Longitude" className={inputClasses} />
                  <Input value={content?.name || ""} onChange={(e) => setContent({ ...content, name: e.target.value })} placeholder="Nome do local" className={inputClasses} />
                  <Input value={content?.address || ""} onChange={(e) => setContent({ ...content, address: e.target.value })} placeholder="Endereço" className={inputClasses} />
                </div>
              )}

              {messageType === "poll" && (
                <div className="space-y-2">
                  <Input value={content?.question || ""} onChange={(e) => setContent({ ...content, question: e.target.value })} placeholder="Pergunta da enquete" className={inputClasses} />
                  {(content?.options || ["", ""]).map((opt: string, oi: number) => (
                    <div key={oi} className="flex items-center gap-1.5">
                      <Input value={opt} onChange={(e) => {
                        const opts = [...(content?.options || ["", ""])];
                        opts[oi] = e.target.value;
                        setContent({ ...content, options: opts });
                      }} placeholder={`Opção ${oi + 1}`} className={inputClasses} />
                      {(content?.options || []).length > 2 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => {
                          const opts = [...(content?.options || [])];
                          opts.splice(oi, 1);
                          setContent({ ...content, options: opts });
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] text-primary hover:text-primary" onClick={() => setContent({ ...content, options: [...(content?.options || []), ""] })}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar opção
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] text-muted-foreground">Selecionáveis:</Label>
                    <Input type="number" min={1} max={(content?.options || []).length} value={content?.selectableCount || 1} onChange={(e) => setContent({ ...content, selectableCount: parseInt(e.target.value) || 1 })} className="h-7 w-16 text-xs bg-secondary border-border focus:border-primary/50" />
                  </div>
                </div>
              )}

              {messageType === "list" && (
                <div className="space-y-2">
                  <Input value={content?.title || ""} onChange={(e) => setContent({ ...content, title: e.target.value })} placeholder="Título da lista" className={inputClasses} />
                  <Input value={content?.description || ""} onChange={(e) => setContent({ ...content, description: e.target.value })} placeholder="Descrição" className={inputClasses} />
                  <Input value={content?.buttonText || ""} onChange={(e) => setContent({ ...content, buttonText: e.target.value })} placeholder="Texto do botão" className={inputClasses} />
                  <Input value={content?.footer || ""} onChange={(e) => setContent({ ...content, footer: e.target.value })} placeholder="Rodapé (opcional)" className={inputClasses} />
                </div>
              )}
            </div>

            {/* Schedule */}
            <div className="space-y-3 border-t border-border pt-4">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Agendamento
              </Label>

              {scheduleType === "once" && (
                <div className="flex gap-2 flex-wrap">
                  <Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={cn(inputClasses, "w-40")} />
                  <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className={cn(inputClasses, "w-28")} />
                </div>
              )}

              {scheduleType === "daily" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Enviar todo dia às</span>
                  <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className={cn(inputClasses, "w-28")} />
                </div>
              )}

              {scheduleType === "weekly" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map(d => (
                      <button key={d.value} type="button" onClick={() => toggleWeekday(d.value)}
                        className={cn(
                          "h-8 w-10 rounded-md text-xs font-medium transition-all border",
                          weekdays.includes(d.value)
                            ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "bg-secondary border-border text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">às</span>
                    <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className={cn(inputClasses, "w-28")} />
                  </div>
                </div>
              )}

              {scheduleType === "monthly" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Dia</span>
                  <Input type="number" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(parseInt(e.target.value) || 1)} className={cn(inputClasses, "w-16")} />
                  <span className="text-xs text-muted-foreground">às</span>
                  <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className={cn(inputClasses, "w-28")} />
                </div>
              )}

              {scheduleType === "custom" && (
                <div className="space-y-2">
                  <Input value={customDays} onChange={(e) => setCustomDays(e.target.value)} placeholder="Dias do mês (ex: 1,5,10,15,20)" className={inputClasses} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">às</span>
                    <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className={cn(inputClasses, "w-28")} />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {editData ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="hidden lg:block h-[500px]">
            <WhatsAppPreview messageType={messageType} content={content} mentionAll={mentionAll} forceLinkPreview={forceLinkPreview} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
