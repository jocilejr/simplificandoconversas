import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  messageType: string;
  content: any;
  scheduleType: string;
  intervalMinutes?: number;
  cronExpression?: string;
}

interface Props {
  messages: Message[];
  onChange: (messages: Message[]) => void;
}

const messageTypes = [
  { value: "text", label: "Texto" },
  { value: "image", label: "Imagem" },
  { value: "video", label: "Vídeo" },
  { value: "audio", label: "Áudio" },
  { value: "document", label: "Documento" },
  { value: "sticker", label: "Sticker" },
  { value: "contact", label: "Contato" },
  { value: "location", label: "Localização" },
  { value: "poll", label: "Enquete" },
  { value: "list", label: "Lista" },
];

const scheduleTypes = [
  { value: "once", label: "Único" },
  { value: "daily", label: "Diário" },
  { value: "interval", label: "Intervalo" },
  { value: "cron", label: "Cron" },
];

export default function GroupMessageEditor({ messages, onChange }: Props) {
  const update = (index: number, partial: Partial<Message>) => {
    const next = [...messages];
    next[index] = { ...next[index], ...partial };
    onChange(next);
  };

  const addMessage = () => {
    onChange([...messages, { messageType: "text", content: { text: "" }, scheduleType: "once" }]);
  };

  const removeMessage = (index: number) => {
    onChange(messages.filter((_, i) => i !== index));
  };

  const getDefaultContent = (type: string) => {
    switch (type) {
      case "text": return { text: "" };
      case "contact": return { contactName: "", contactPhone: "" };
      case "location": return { latitude: "", longitude: "", name: "" };
      case "poll": return { question: "", options: ["", ""] };
      case "list": return { title: "", description: "", buttonText: "", sections: [] };
      default: return { mediaUrl: "", caption: "" };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5">
          Mensagens
          <Badge variant="secondary" className="text-[10px] h-5">{messages.length}</Badge>
        </Label>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addMessage}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>

      {messages.map((msg, i) => (
        <div key={i} className="border border-border/50 rounded-lg p-3 space-y-3 bg-background/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
            {messages.length > 1 && (
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeMessage(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Tipo</Label>
              <Select
                value={msg.messageType}
                onValueChange={(v) => update(i, { messageType: v, content: getDefaultContent(v) })}
              >
                <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {messageTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Agendamento</Label>
              <Select value={msg.scheduleType} onValueChange={(v) => update(i, { scheduleType: v })}>
                <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scheduleTypes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content fields based on type */}
          {msg.messageType === "text" && (
            <Textarea
              value={msg.content?.text || ""}
              onChange={(e) => update(i, { content: { text: e.target.value } })}
              placeholder="Texto da mensagem..."
              rows={3}
              className="text-sm bg-background/50 border-border/50 resize-none"
            />
          )}

          {["image", "video", "audio", "document", "sticker"].includes(msg.messageType) && (
            <div className="space-y-2">
              <Input
                value={msg.content?.mediaUrl || ""}
                onChange={(e) => update(i, { content: { ...msg.content, mediaUrl: e.target.value } })}
                placeholder="URL da mídia"
                className="h-8 text-sm bg-background/50 border-border/50"
              />
              {msg.messageType !== "sticker" && (
                <Input
                  value={msg.content?.caption || ""}
                  onChange={(e) => update(i, { content: { ...msg.content, caption: e.target.value } })}
                  placeholder="Legenda (opcional)"
                  className="h-8 text-sm bg-background/50 border-border/50"
                />
              )}
            </div>
          )}

          {msg.messageType === "contact" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={msg.content?.contactName || ""}
                onChange={(e) => update(i, { content: { ...msg.content, contactName: e.target.value } })}
                placeholder="Nome do contato"
                className="h-8 text-sm bg-background/50 border-border/50"
              />
              <Input
                value={msg.content?.contactPhone || ""}
                onChange={(e) => update(i, { content: { ...msg.content, contactPhone: e.target.value } })}
                placeholder="Telefone"
                className="h-8 text-sm bg-background/50 border-border/50"
              />
            </div>
          )}

          {msg.messageType === "location" && (
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={msg.content?.latitude || ""}
                onChange={(e) => update(i, { content: { ...msg.content, latitude: e.target.value } })}
                placeholder="Latitude"
                className="h-8 text-sm bg-background/50 border-border/50"
              />
              <Input
                value={msg.content?.longitude || ""}
                onChange={(e) => update(i, { content: { ...msg.content, longitude: e.target.value } })}
                placeholder="Longitude"
                className="h-8 text-sm bg-background/50 border-border/50"
              />
              <Input
                value={msg.content?.name || ""}
                onChange={(e) => update(i, { content: { ...msg.content, name: e.target.value } })}
                placeholder="Nome do local"
                className="h-8 text-sm bg-background/50 border-border/50"
              />
            </div>
          )}

          {msg.messageType === "poll" && (
            <div className="space-y-2">
              <Input
                value={msg.content?.question || ""}
                onChange={(e) => update(i, { content: { ...msg.content, question: e.target.value } })}
                placeholder="Pergunta da enquete"
                className="h-8 text-sm bg-background/50 border-border/50"
              />
              {(msg.content?.options || ["", ""]).map((opt: string, oi: number) => (
                <Input
                  key={oi}
                  value={opt}
                  onChange={(e) => {
                    const opts = [...(msg.content?.options || ["", ""])];
                    opts[oi] = e.target.value;
                    update(i, { content: { ...msg.content, options: opts } });
                  }}
                  placeholder={`Opção ${oi + 1}`}
                  className="h-8 text-sm bg-background/50 border-border/50"
                />
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={() => update(i, { content: { ...msg.content, options: [...(msg.content?.options || []), ""] } })}
              >
                <Plus className="h-3 w-3 mr-1" /> Opção
              </Button>
            </div>
          )}

          {/* Schedule fields */}
          {msg.scheduleType === "interval" && (
            <div className="space-y-1">
              <Label className="text-[11px]">Intervalo (min)</Label>
              <Input
                type="number"
                value={msg.intervalMinutes || ""}
                onChange={(e) => update(i, { intervalMinutes: parseInt(e.target.value) || undefined })}
                placeholder="60"
                className="h-8 text-sm bg-background/50 border-border/50 w-32"
              />
            </div>
          )}

          {msg.scheduleType === "cron" && (
            <div className="space-y-1">
              <Label className="text-[11px]">Expressão Cron</Label>
              <Input
                value={msg.cronExpression || ""}
                onChange={(e) => update(i, { cronExpression: e.target.value })}
                placeholder="0 9 * * *"
                className="h-8 text-sm bg-background/50 border-border/50 w-48"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
