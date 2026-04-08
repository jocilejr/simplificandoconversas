import { useState, useEffect } from "react";
import {
  MessageSquare, Image, Video, Mic, FileText, Sticker, MapPin, Contact, BarChart3, List,
  Clock, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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

interface Props {
  scheduleType: string;
  editData?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isPending?: boolean;
}

function getDefaultContent(type: string) {
  switch (type) {
    case "text": return { text: "" };
    case "contact": return { contactName: "", contactPhone: "" };
    case "location": return { latitude: "", longitude: "", name: "" };
    case "poll": return { question: "", options: ["", ""] };
    case "list": return { title: "", description: "", buttonText: "Ver opções", sections: [] };
    default: return { mediaUrl: "", caption: "" };
  }
}

export default function GroupScheduledMessageForm({ scheduleType, editData, onSave, onCancel, isPending }: Props) {
  const [messageType, setMessageType] = useState("text");
  const [content, setContent] = useState<any>({ text: "" });
  const [scheduledAt, setScheduledAt] = useState("");
  const [timeValue, setTimeValue] = useState("09:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [monthDay, setMonthDay] = useState(1);
  const [customDays, setCustomDays] = useState("");
  const [mentionAll, setMentionAll] = useState(false);

  useEffect(() => {
    if (editData) {
      setMessageType(editData.message_type || "text");
      setContent(editData.content || { text: "" });
      setMentionAll(editData.content?.mentionAll || false);
      if (editData.scheduled_at) {
        const d = new Date(editData.scheduled_at);
        setScheduledAt(d.toISOString().slice(0, 10));
        setTimeValue(d.toISOString().slice(11, 16));
      }
      if (editData.content?.weekdays) setWeekdays(editData.content.weekdays);
      if (editData.content?.monthDay) setMonthDay(editData.content.monthDay);
      if (editData.content?.customDays) setCustomDays(editData.content.customDays);
      if (editData.content?.time) setTimeValue(editData.content.time);
    }
  }, [editData]);

  const toggleWeekday = (d: number) => {
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const handleSubmit = () => {
    const finalContent = { ...content, mentionAll };

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

  return (
    <div className="space-y-4 p-4 border border-border/50 rounded-lg bg-background/50">
      {/* Type grid */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Tipo de mensagem</Label>
        <div className="grid grid-cols-5 gap-1.5">
          {MESSAGE_TYPES.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => { setMessageType(t.value); setContent(getDefaultContent(t.value)); }}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-all",
                  messageType === t.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 hover:border-primary/30 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px]">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content fields */}
      <div className="space-y-2">
        {messageType === "text" && (
          <Textarea
            value={content?.text || ""}
            onChange={(e) => setContent({ ...content, text: e.target.value })}
            placeholder="Texto da mensagem..."
            rows={4}
            className="text-sm bg-background/50 border-border/50 resize-none"
          />
        )}

        {["image", "video", "audio", "document", "sticker"].includes(messageType) && (
          <div className="space-y-2">
            <Input value={content?.mediaUrl || ""} onChange={(e) => setContent({ ...content, mediaUrl: e.target.value })} placeholder="URL da mídia" className="h-8 text-sm bg-background/50 border-border/50" />
            {messageType !== "sticker" && messageType !== "audio" && (
              <Input value={content?.caption || ""} onChange={(e) => setContent({ ...content, caption: e.target.value })} placeholder="Legenda (opcional)" className="h-8 text-sm bg-background/50 border-border/50" />
            )}
          </div>
        )}

        {messageType === "contact" && (
          <div className="grid grid-cols-2 gap-2">
            <Input value={content?.contactName || ""} onChange={(e) => setContent({ ...content, contactName: e.target.value })} placeholder="Nome do contato" className="h-8 text-sm bg-background/50 border-border/50" />
            <Input value={content?.contactPhone || ""} onChange={(e) => setContent({ ...content, contactPhone: e.target.value })} placeholder="Telefone" className="h-8 text-sm bg-background/50 border-border/50" />
          </div>
        )}

        {messageType === "location" && (
          <div className="grid grid-cols-3 gap-2">
            <Input value={content?.latitude || ""} onChange={(e) => setContent({ ...content, latitude: e.target.value })} placeholder="Latitude" className="h-8 text-sm bg-background/50 border-border/50" />
            <Input value={content?.longitude || ""} onChange={(e) => setContent({ ...content, longitude: e.target.value })} placeholder="Longitude" className="h-8 text-sm bg-background/50 border-border/50" />
            <Input value={content?.name || ""} onChange={(e) => setContent({ ...content, name: e.target.value })} placeholder="Nome do local" className="h-8 text-sm bg-background/50 border-border/50" />
          </div>
        )}

        {messageType === "poll" && (
          <div className="space-y-2">
            <Input value={content?.question || ""} onChange={(e) => setContent({ ...content, question: e.target.value })} placeholder="Pergunta da enquete" className="h-8 text-sm bg-background/50 border-border/50" />
            {(content?.options || ["", ""]).map((opt: string, oi: number) => (
              <Input key={oi} value={opt} onChange={(e) => {
                const opts = [...(content?.options || ["", ""])];
                opts[oi] = e.target.value;
                setContent({ ...content, options: opts });
              }} placeholder={`Opção ${oi + 1}`} className="h-8 text-sm bg-background/50 border-border/50" />
            ))}
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setContent({ ...content, options: [...(content?.options || []), ""] })}>
              + Opção
            </Button>
          </div>
        )}

        {messageType === "list" && (
          <div className="space-y-2">
            <Input value={content?.title || ""} onChange={(e) => setContent({ ...content, title: e.target.value })} placeholder="Título da lista" className="h-8 text-sm bg-background/50 border-border/50" />
            <Input value={content?.description || ""} onChange={(e) => setContent({ ...content, description: e.target.value })} placeholder="Descrição" className="h-8 text-sm bg-background/50 border-border/50" />
            <Input value={content?.buttonText || ""} onChange={(e) => setContent({ ...content, buttonText: e.target.value })} placeholder="Texto do botão" className="h-8 text-sm bg-background/50 border-border/50" />
          </div>
        )}
      </div>

      {/* Schedule fields */}
      <div className="space-y-2 border-t border-border/30 pt-3">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          Agendamento
        </Label>

        {scheduleType === "once" && (
          <div className="flex gap-2">
            <Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-8 text-sm bg-background/50 border-border/50 w-40" />
            <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="h-8 text-sm bg-background/50 border-border/50 w-28" />
          </div>
        )}

        {scheduleType === "daily" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Enviar todo dia às</span>
            <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="h-8 text-sm bg-background/50 border-border/50 w-28" />
          </div>
        )}

        {scheduleType === "weekly" && (
          <div className="space-y-2">
            <div className="flex gap-1">
              {WEEKDAYS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  className={cn(
                    "h-8 w-10 rounded text-xs font-medium transition-all border",
                    weekdays.includes(d.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/50 border-border/50 text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">às</span>
              <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="h-8 text-sm bg-background/50 border-border/50 w-28" />
            </div>
          </div>
        )}

        {scheduleType === "monthly" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Dia</span>
            <Input type="number" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(parseInt(e.target.value) || 1)} className="h-8 text-sm bg-background/50 border-border/50 w-16" />
            <span className="text-xs text-muted-foreground">às</span>
            <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="h-8 text-sm bg-background/50 border-border/50 w-28" />
          </div>
        )}

        {scheduleType === "custom" && (
          <div className="space-y-2">
            <Input value={customDays} onChange={(e) => setCustomDays(e.target.value)} placeholder="Dias do mês (ex: 1,5,10,15,20)" className="h-8 text-sm bg-background/50 border-border/50" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">às</span>
              <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="h-8 text-sm bg-background/50 border-border/50 w-28" />
            </div>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex items-center gap-4 border-t border-border/30 pt-3">
        <div className="flex items-center gap-2">
          <Checkbox checked={mentionAll} onCheckedChange={(v) => setMentionAll(!!v)} />
          <Label className="text-xs">Mencionar todos</Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending}>
          <Save className="h-3.5 w-3.5 mr-1" />
          {editData ? "Atualizar" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
