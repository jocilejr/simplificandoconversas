import { useState, useEffect } from "react";
import {
  MessageSquare, Image, Video, Mic, FileText, Sticker, MapPin, Contact, BarChart3, List,
  Clock, Save, Plus, Trash2, AtSign, Link2, CalendarClock
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
  { value: "text", label: "Texto", icon: FileText },
  { value: "image", label: "Imagem", icon: Image },
  { value: "video", label: "Vídeo", icon: Video },
  { value: "audio", label: "Áudio", icon: Mic },
  { value: "document", label: "Doc", icon: FileText },
  { value: "sticker", label: "Figurinha", icon: Sticker },
  { value: "location", label: "Local", icon: MapPin },
  { value: "contact", label: "Contato", icon: Contact },
  { value: "poll", label: "Enquete", icon: BarChart3 },
  { value: "list", label: "Lista", icon: List },
];

const WEEKDAYS = [
  { value: 0, label: "Dom" }, { value: 1, label: "Seg" }, { value: 2, label: "Ter" },
  { value: 3, label: "Qua" }, { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" },
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

export default function GroupScheduledMessageForm({ open, onOpenChange, scheduleType, editData, onSave, isPending }: Props) {
  const [messageType, setMessageType] = useState("text");
  // Text
  const [textContent, setTextContent] = useState("");
  const [mentionAll, setMentionAll] = useState(false);
  const [forceLinkPreview, setForceLinkPreview] = useState(true);
  // Media
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  // Location
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");
  // Contact
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  // Poll
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollSelectable, setPollSelectable] = useState(1);
  // List
  const [listTitle, setListTitle] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [listButtonText, setListButtonText] = useState("Ver opções");
  const [listFooter, setListFooter] = useState("");
  // Schedule
  const [scheduledAt, setScheduledAt] = useState("");
  const [timeValue, setTimeValue] = useState("09:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [monthDay, setMonthDay] = useState(1);
  const [customDays, setCustomDays] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editData) {
      const c = editData.content || {};
      setMessageType(editData.message_type || "text");
      setTextContent(c.text || "");
      setMentionAll(c.mentionAll || c.mentionsEveryOne || false);
      setForceLinkPreview(c.forceLinkPreview !== false);
      setMediaUrl(c.mediaUrl || c.audio || c.sticker || "");
      setCaption(c.caption || "");
      setLocName(c.name || ""); setLocAddress(c.address || "");
      setLocLat(c.latitude?.toString() || ""); setLocLng(c.longitude?.toString() || "");
      setContactName(c.contactName || ""); setContactPhone(c.contactPhone || "");
      setPollQuestion(c.question || c.pollName || "");
      setPollOptions(c.options || c.pollOptions || ["", ""]);
      setPollSelectable(c.selectableCount || c.pollSelectable || 1);
      setListTitle(c.title || c.listTitle || "");
      setListDescription(c.description || c.listDescription || "");
      setListButtonText(c.buttonText || c.listButtonText || "Ver opções");
      setListFooter(c.footer || c.listFooter || "");

      // Scheduling - restore exact saved values
      if (editData.content?.time) {
        setTimeValue(editData.content.time);
      } else if (editData.content?.runTime) {
        setTimeValue(editData.content.runTime);
      } else if (editData.scheduled_at) {
        const d = new Date(editData.scheduled_at);
        setTimeValue(d.toISOString().slice(11, 16));
      } else {
        setTimeValue("09:00");
      }

      if (editData.scheduled_at) {
        const d = new Date(editData.scheduled_at);
        setScheduledAt(d.toISOString().slice(0, 10));
      } else {
        setScheduledAt("");
      }

      if (editData.content?.weekdays) setWeekdays(editData.content.weekdays);
      else if (editData.cron_expression) {
        // Parse weekdays from cron: M H * * 0,1,2,...
        const parts = editData.cron_expression.split(" ");
        if (parts.length >= 5 && parts[4] !== "*") {
          setWeekdays(parts[4].split(",").map(Number).filter((n: number) => !isNaN(n)));
        }
      }

      if (editData.content?.monthDay) setMonthDay(editData.content.monthDay);
      if (editData.content?.customDays) setCustomDays(editData.content.customDays);
    } else {
      setMessageType("text"); setTextContent(""); setMentionAll(false); setForceLinkPreview(true);
      setMediaUrl(""); setCaption("");
      setLocName(""); setLocAddress(""); setLocLat(""); setLocLng("");
      setContactName(""); setContactPhone("");
      setPollQuestion(""); setPollOptions(["", ""]); setPollSelectable(1);
      setListTitle(""); setListDescription(""); setListButtonText("Ver opções"); setListFooter("");
      setScheduledAt(""); setTimeValue("09:00");
      setWeekdays([1, 2, 3, 4, 5]); setMonthDay(1); setCustomDays("");
    }
  }, [open, editData]);

  const toggleWeekday = (d: number) => {
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const buildContent = () => {
    const base: any = { mentionAll, forceLinkPreview };
    switch (messageType) {
      case "text": return { ...base, text: textContent };
      case "image": case "video": case "document": case "sticker": case "audio":
        return { ...base, mediaUrl, caption };
      case "location": return { ...base, latitude: locLat, longitude: locLng, name: locName, address: locAddress };
      case "contact": return { ...base, contactName, contactPhone };
      case "poll": return { ...base, question: pollQuestion, options: pollOptions, selectableCount: pollSelectable };
      case "list": return { ...base, title: listTitle, description: listDescription, buttonText: listButtonText, footer: listFooter };
      default: return base;
    }
  };

  const handleSubmit = () => {
    const finalContent = buildContent();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1100px] max-h-[90vh] flex flex-col sm:rounded-2xl border-border/50 bg-card p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{editData ? "Editar Mensagem" : "Nova Mensagem Agendada"}</DialogTitle>
              <DialogDescription className="text-xs">
                {editData ? "Edite" : "Configure"} o conteúdo e agendamento — {SCHEDULE_LABELS[scheduleType] || scheduleType}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex">
          {/* Left: Form */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-5">
            {/* Message type grid */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo de mensagem</Label>
              <div className="grid grid-cols-5 sm:grid-cols-5 gap-1.5">
                {MESSAGE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      setMessageType(t.value);
                      setTextContent(""); setMediaUrl(""); setCaption("");
                      setLocName(""); setLocAddress(""); setLocLat(""); setLocLng("");
                      setContactName(""); setContactPhone("");
                      setPollQuestion(""); setPollOptions(["", ""]); setPollSelectable(1);
                      setListTitle(""); setListDescription(""); setListButtonText("Ver opções"); setListFooter("");
                      setMentionAll(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-[11px] font-medium",
                      messageType === t.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                    )}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content fields */}
            {messageType === "text" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensagem</Label>
                  <Textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Digite sua mensagem... Use *negrito*, _itálico_, ~tachado~"
                    className="bg-background/50 border-border/50 resize-none min-h-[60px]"
                    style={{ fieldSizing: 'content' } as any}
                  />
                  <p className="text-[11px] text-muted-foreground">{textContent.length} caracteres</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Preview de link</p>
                      <p className="text-[11px] text-muted-foreground">Exibe preview de links na mensagem</p>
                    </div>
                  </div>
                  <Switch checked={forceLinkPreview} onCheckedChange={setForceLinkPreview} />
                </div>
              </div>
            )}

            {["image", "video", "document", "audio", "sticker"].includes(messageType) && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Arquivo</Label>
                  <Input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="URL da mídia"
                    className="bg-background/50 border-border/50"
                  />
                </div>
                {messageType !== "sticker" && messageType !== "audio" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legenda (opcional)</Label>
                    <Textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Legenda..."
                      className="bg-background/50 border-border/50 resize-none min-h-[40px]"
                      style={{ fieldSizing: 'content' } as any}
                    />
                  </div>
                )}
              </div>
            )}

            {messageType === "location" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Latitude *</Label>
                    <Input value={locLat} onChange={(e) => setLocLat(e.target.value)} placeholder="-23.5505" className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Longitude *</Label>
                    <Input value={locLng} onChange={(e) => setLocLng(e.target.value)} placeholder="-46.6333" className="bg-background/50 border-border/50" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do local (opcional)</Label>
                  <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Ex: Escritório" className="bg-background/50 border-border/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Endereço (opcional)</Label>
                  <Input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} placeholder="Rua, número, bairro..." className="bg-background/50 border-border/50" />
                </div>
              </div>
            )}

            {messageType === "contact" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do contato *</Label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="João Silva" className="bg-background/50 border-border/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Telefone *</Label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="5511999998888" className="bg-background/50 border-border/50" />
                </div>
              </div>
            )}

            {messageType === "poll" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Pergunta *</Label>
                  <Input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Qual a sua preferência?" className="bg-background/50 border-border/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Opções</Label>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o); }}
                        placeholder={`Opção ${i + 1}`}
                        className="bg-background/50 border-border/50 text-sm"
                      />
                      {pollOptions.length > 2 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="text-[11px] gap-1 border-dashed" onClick={() => setPollOptions([...pollOptions, ""])}>
                    <Plus className="h-3 w-3" /> Opção
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Selecionáveis</Label>
                  <Input type="number" min={1} max={pollOptions.length} value={pollSelectable} onChange={(e) => setPollSelectable(parseInt(e.target.value) || 1)} className="bg-background/50 border-border/50 w-20" />
                </div>
              </div>
            )}

            {messageType === "list" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Título *</Label>
                    <Input value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="Título da lista" className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Texto do botão</Label>
                    <Input value={listButtonText} onChange={(e) => setListButtonText(e.target.value)} placeholder="Ver opções" className="bg-background/50 border-border/50" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Descrição *</Label>
                  <Textarea value={listDescription} onChange={(e) => setListDescription(e.target.value)} placeholder="Descrição" className="bg-background/50 border-border/50 resize-none min-h-[40px]" style={{ fieldSizing: 'content' } as any} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Rodapé</Label>
                  <Input value={listFooter} onChange={(e) => setListFooter(e.target.value)} placeholder="Texto do rodapé" className="bg-background/50 border-border/50" />
                </div>
              </div>
            )}

            {/* Send options */}
            <div className="border-t border-border/30 pt-4 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opções de envio</h4>
              {SUPPORTS_MENTION.includes(messageType) && (
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <AtSign className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Mencionar todos</p>
                      <p className="text-[11px] text-muted-foreground">Marca todos os participantes do grupo</p>
                    </div>
                  </div>
                  <Switch checked={mentionAll} onCheckedChange={setMentionAll} />
                </div>
              )}
            </div>

            {/* Schedule config */}
            <div className="border-t border-border/30 pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agendamento</h4>

              {scheduleType === "once" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Data</Label>
                    <Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Horário</Label>
                    <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="bg-background/50 border-border/50" />
                  </div>
                </div>
              )}

              {scheduleType === "daily" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Horário diário</Label>
                  <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="bg-background/50 border-border/50 w-36" />
                </div>
              )}

              {scheduleType === "weekly" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Horário</Label>
                    <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="bg-background/50 border-border/50 w-36" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dias</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => toggleWeekday(d.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                            weekdays.includes(d.value)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                          )}
                        >{d.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {scheduleType === "monthly" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dia do mês</Label>
                    <Input type="number" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(parseInt(e.target.value) || 1)} className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Horário</Label>
                    <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="bg-background/50 border-border/50" />
                  </div>
                </div>
              )}

              {scheduleType === "custom" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Horário</Label>
                    <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="bg-background/50 border-border/50 w-36" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dias do mês</Label>
                    <Input value={customDays} onChange={(e) => setCustomDays(e.target.value)} placeholder="1,5,10,15,20" className="bg-background/50 border-border/50" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: WhatsApp Preview */}
          <div className="hidden md:flex w-[340px] shrink-0 border-l border-border/30 flex-col">
            <div className="px-4 py-3 border-b border-border/30">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</Label>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center">
              <div className="w-full sticky top-0">
                <WhatsAppPreview
                  messageType={messageType}
                  textContent={textContent}
                  mediaUrl={mediaUrl}
                  caption={caption}
                  locName={locName}
                  locAddress={locAddress}
                  locLat={locLat}
                  locLng={locLng}
                  contactName={contactName}
                  contactPhone={contactPhone}
                  pollName={pollQuestion}
                  pollOptions={pollOptions}
                  listTitle={listTitle}
                  listDescription={listDescription}
                  listButtonText={listButtonText}
                  listFooter={listFooter}
                  mentionAll={mentionAll}
                  forceLinkPreview={forceLinkPreview}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/30 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border/50">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {editData ? "Salvar" : "Agendar Mensagem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
