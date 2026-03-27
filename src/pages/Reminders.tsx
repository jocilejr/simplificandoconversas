import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Smartphone,
  Phone,
  User,
  MessageSquare,
  ChevronRight,
  Copy,
  Check,
  FileText,
  Loader2,
} from "lucide-react";
import {
  useReminders,
  useCreateReminder,
  useToggleReminder,
  useDeleteReminder,
  type Reminder,
} from "@/hooks/useReminders";
import { useReminderConversation } from "@/hooks/useReminderConversation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  isToday,
  isBefore,
  startOfDay,
  isSameDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getReminderStatus(r: Reminder): "overdue" | "today" | "upcoming" | "completed" {
  if (r.completed) return "completed";
  const due = new Date(r.due_date);
  const now = new Date();
  if (isBefore(due, startOfDay(now))) return "overdue";
  if (isToday(due)) return "today";
  return "upcoming";
}

const STATUS_MAP = {
  overdue: { label: "Atrasado", className: "bg-destructive/20 text-destructive border-destructive/30" },
  today: { label: "Hoje", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
  upcoming: { label: "Futuro", className: "bg-primary/20 text-primary border-primary/30" },
  completed: { label: "Concluído", className: "bg-muted text-muted-foreground border-border" },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_MAP }) {
  const s = STATUS_MAP[status];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

function useInstanceList() {
  return useQuery({
    queryKey: ["whatsapp-instances-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => d.instance_name as string);
    },
  });
}

// ─── Detalhe do lembrete (Sheet) ─────────────────────────────────────────────

function ReminderDetail({ reminder }: { reminder: Reminder }) {
  const status = getReminderStatus(reminder);
  const [copied, setCopied] = useState(false);
  const { data: messages = [], isLoading: isLoadingMsgs } = useReminderConversation(
    reminder.remote_jid,
    reminder.instance_name
  );

  // Mensagens ordenadas da mais recente para a mais antiga
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleCopy = () => {
    if (reminder.phone_number) {
      navigator.clipboard.writeText(reminder.phone_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Contato */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>

        {reminder.instance_name && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Instância</p>
              <p className="text-sm font-medium">{reminder.instance_name}</p>
            </div>
          </div>
        )}

        {reminder.contact_name && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Nome</p>
              <p className="text-sm font-semibold">{reminder.contact_name}</p>
            </div>
          </div>
        )}

        {reminder.phone_number && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Phone className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium font-mono">{reminder.phone_number}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <StatusBadge status={status} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            {format(new Date(reminder.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* Nota */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" /> Nota do Lembrete
        </p>
        <p className="text-sm font-semibold">{reminder.title}</p>
        {reminder.description ? (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{reminder.description}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Sem descrição</p>
        )}
      </div>

      {/* Histórico: último → primeiro */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> Conversa (mais recente primeiro)
        </p>

        {isLoadingMsgs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reversedMessages.length === 0 ? (
          <div className="py-6 text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs text-muted-foreground">Nenhuma mensagem encontrada</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
            {reversedMessages.map((msg) => {
              const isOut = msg.direction === "outbound";
              return (
                <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                    isOut
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-bl-sm"
                  }`}>
                    {msg.message_type === "text" || msg.message_type === "conversation" ? (
                      <p className="leading-snug whitespace-pre-wrap break-words">{msg.content}</p>
                    ) : (
                      <p className="italic opacity-70 text-xs">
                        {msg.message_type === "image" ? "🖼 Imagem" :
                          msg.message_type === "audio" ? "🎵 Áudio" :
                          msg.message_type === "video" ? "🎬 Vídeo" :
                          msg.message_type === "document" ? "📄 Documento" :
                          `📎 ${msg.message_type}`}
                        {msg.content && ` — ${msg.content}`}
                      </p>
                    )}
                    <p className={`text-[10px] mt-1 ${isOut ? "text-primary-foreground/60 text-right" : "text-muted-foreground"}`}>
                      {format(new Date(msg.created_at), "dd/MM HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card de lembrete (lista lateral) ────────────────────────────────────────

function ReminderCard({
  reminder,
  onSelect,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  onSelect: (r: Reminder) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const status = getReminderStatus(reminder);

  return (
    <Card
      className={`bg-card border-border hover:border-primary/40 transition-all cursor-pointer group ${
        reminder.completed ? "opacity-60" : ""
      }`}
      onClick={() => onSelect(reminder)}
    >
      <CardContent className="p-4 space-y-2">
        {/* Status + instância */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={status} />
          {reminder.instance_name && (
            <Badge variant="outline" className="gap-1 text-xs border-muted-foreground/25 text-muted-foreground font-normal">
              <Smartphone className="h-3 w-3" />
              {reminder.instance_name}
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* Nome e telefone */}
        <div>
          {reminder.contact_name && (
            <p className="font-semibold text-sm leading-tight">{reminder.contact_name}</p>
          )}
          {reminder.phone_number && (
            <p className="text-xs text-muted-foreground font-mono">{reminder.phone_number}</p>
          )}
        </div>

        {/* Título */}
        <p className={`text-xs text-muted-foreground line-clamp-2 ${reminder.completed ? "line-through" : ""}`}>
          {reminder.title}
        </p>

        {/* Rodapé: hora + ações */}
        <div
          className="flex items-center justify-between pt-2 border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(reminder.due_date), "HH:mm")}
          </span>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={reminder.completed}
              onCheckedChange={(v) => onToggle(reminder.id, !!v)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(reminder.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Reminders() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Reminder | null>(null);

  // Busca todos os lembretes sem filtro de aba (para marcar o calendário)
  const { data: allReminders = [], isLoading } = useReminders("all");
  const { data: instanceList = [] } = useInstanceList();
  const createReminder = useCreateReminder();
  const toggleReminder = useToggleReminder();
  const deleteReminder = useDeleteReminder();

  const [form, setForm] = useState({
    title: "",
    description: "",
    phone_number: "",
    contact_name: "",
    due_date: "",
    due_time: "09:00",
    instance_name: "",
  });

  // Datas que têm lembretes (para marcar no calendário)
  const markedDates = useMemo(
    () => allReminders.map((r) => parseISO(r.due_date)),
    [allReminders]
  );

  // Lembretes do dia selecionado, ordenados por horário
  const dayReminders = useMemo(
    () =>
      allReminders
        .filter((r) => isSameDay(parseISO(r.due_date), selectedDate))
        .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime()),
    [allReminders, selectedDate]
  );

  const overdueCount = useMemo(
    () => allReminders.filter((r) => getReminderStatus(r) === "overdue").length,
    [allReminders]
  );
  const todayCount = useMemo(
    () => allReminders.filter((r) => getReminderStatus(r) === "today").length,
    [allReminders]
  );

  const handleCreate = () => {
    if (!form.title || !form.phone_number || !form.due_date) return;
    const cleaned = form.phone_number.replace(/\D/g, "");
    const dueDateTime = new Date(`${form.due_date}T${form.due_time}:00`);

    createReminder.mutate(
      {
        title: form.title,
        description: form.description || undefined,
        phone_number: cleaned,
        contact_name: form.contact_name || undefined,
        remote_jid: `${cleaned}@s.whatsapp.net`,
        due_date: dueDateTime.toISOString(),
        instance_name: form.instance_name || undefined,
      },
      {
        onSuccess: () => {
          setForm({ title: "", description: "", phone_number: "", contact_name: "", due_date: "", due_time: "09:00", instance_name: "" });
          setDialogOpen(false);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Lembretes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie lembretes de pagamento e acompanhamento de contatos
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Lembrete
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Lembrete</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                placeholder="Título do lembrete"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Telefone"
                  value={form.phone_number}
                  onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))}
                />
                <Input
                  placeholder="Nome do contato"
                  value={form.contact_name}
                  onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
                />
              </div>
              <Select value={form.instance_name} onValueChange={(v) => setForm((p) => ({ ...p, instance_name: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Instância WhatsApp" />
                </SelectTrigger>
                <SelectContent>
                  {instanceList.map((name) => (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-2">
                        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                        {name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                />
                <Input
                  type="time"
                  value={form.due_time}
                  onChange={(e) => setForm((p) => ({ ...p, due_time: e.target.value }))}
                />
              </div>
              <Textarea
                placeholder="Descrição (opcional)"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createReminder.isPending || !form.title || !form.phone_number || !form.due_date}
              >
                {createReminder.isPending ? "Criando..." : "Criar Lembrete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sumário rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Clock, color: "destructive", count: overdueCount, label: "Atrasados" },
          { icon: CalendarIcon, color: "yellow-500", count: todayCount, label: "Para hoje" },
          { icon: Bell, color: "primary", count: allReminders.filter((r) => !r.completed).length, label: "Pendentes" },
          { icon: CheckCircle2, color: "muted-foreground", count: allReminders.filter((r) => r.completed).length, label: "Concluídos" },
        ].map(({ icon: Icon, color, count, label }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg bg-${color}/15 flex items-center justify-center`}>
                <Icon className={`h-5 w-5 text-${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Layout split: calendário + lista */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Calendário ── */}
        <div className="w-full lg:w-auto shrink-0">
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={ptBR}
                className="rounded-md"
                modifiers={{ hasReminder: markedDates }}
                modifiersClassNames={{
                  hasReminder: "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary relative",
                }}
              />
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                Dia com lembrete
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Lista do dia selecionado ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            {dayReminders.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {dayReminders.length} lembrete{dayReminders.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dayReminders.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-xl">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhum lembrete neste dia</p>
              <p className="text-xs mt-1 opacity-60">Selecione outro dia ou crie um novo lembrete</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {dayReminders.map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  onSelect={setSelected}
                  onToggle={(id, completed) => toggleReminder.mutate({ id, completed })}
                  onDelete={(id) => deleteReminder.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sheet de detalhes */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Detalhes do Lembrete
            </SheetTitle>
          </SheetHeader>
          {selected && <ReminderDetail reminder={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
