import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Mensagens ({messages.length})</Label>
        <Button size="sm" variant="outline" onClick={addMessage}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>

      {messages.map((msg, i) => (
        <div key={i} className="border rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Mensagem #{i + 1}</span>
            {messages.length > 1 && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeMessage(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={msg.messageType} onValueChange={(v) => update(i, { messageType: v, content: v === "text" ? { text: "" } : { mediaUrl: "", caption: "" } })}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="image">Imagem</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="audio">Áudio</SelectItem>
                  <SelectItem value="document">Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Agendamento</Label>
              <Select value={msg.scheduleType} onValueChange={(v) => update(i, { scheduleType: v })}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Envio Único</SelectItem>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="interval">Intervalo</SelectItem>
                  <SelectItem value="cron">Cron</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {msg.messageType === "text" ? (
            <Textarea
              value={msg.content?.text || ""}
              onChange={(e) => update(i, { content: { text: e.target.value } })}
              placeholder="Texto da mensagem..."
              rows={3}
            />
          ) : (
            <div className="space-y-2">
              <Input
                value={msg.content?.mediaUrl || ""}
                onChange={(e) => update(i, { content: { ...msg.content, mediaUrl: e.target.value } })}
                placeholder="URL da mídia"
              />
              <Input
                value={msg.content?.caption || ""}
                onChange={(e) => update(i, { content: { ...msg.content, caption: e.target.value } })}
                placeholder="Legenda (opcional)"
              />
            </div>
          )}

          {msg.scheduleType === "interval" && (
            <div>
              <Label className="text-xs">Intervalo (minutos)</Label>
              <Input
                type="number"
                value={msg.intervalMinutes || ""}
                onChange={(e) => update(i, { intervalMinutes: parseInt(e.target.value) || undefined })}
                placeholder="60"
                className="h-8"
              />
            </div>
          )}

          {msg.scheduleType === "cron" && (
            <div>
              <Label className="text-xs">Expressão Cron</Label>
              <Input
                value={msg.cronExpression || ""}
                onChange={(e) => update(i, { cronExpression: e.target.value })}
                placeholder="0 9 * * *"
                className="h-8"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
