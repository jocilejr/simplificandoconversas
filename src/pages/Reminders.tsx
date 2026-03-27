import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Calendar,
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
  type ReminderFilter,
  type Reminder,
} from "@/hooks/useReminders";
import { useReminderConversation } from "@/hooks/useReminderConversation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── helpers ──────────────────────────────────────────────────────────────────

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

const filterOptions: { value: ReminderFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "overdue", label: "Atrasados" },
  { value: "today", label: "Hoje" },
  { value: "completed", label: "Concluídos" },
];

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

// ─── ReminderDetail (Sheet content) ──────────────────────────────────────────

function ReminderDetail({ reminder }: { reminder: Reminder }) {
  const status = getReminderStatus(reminder);
  const [copied, setCopied] = useState(false);
  const { data: messages = [], isLoading: isLoadingMsgs } = useReminderConversation(
    reminder.remote_jid,
    reminder.instance_name
  );

  const handleCopyPhone = () => {
    if (reminder.phone_number) {
      navigator.clipboard.writeText(reminder.phone_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ── Seção 1: Identidade do contato ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contato
        </p>

        {reminder.instance_name && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instância</p>
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
              <p className="text-xs text-muted-foreground">Nome</p>
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
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium font-mono">{reminder.phone_number}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={handleCopyPhone}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <StatusBadge status={status} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(reminder.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* ── Seção 2: Título + Nota ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" /> Lembrete
        </p>
        <p className="text-sm font-semibold">{reminder.title}</p>
        {reminder.description ? (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {reminder.description}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Sem descrição</p>
        )}
      </div>

      {/* ── Seção 3: Histórico da conversa ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> Histórico da Conversa
        </p>

        {isLoadingMsgs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-6 text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs text-muted-foreground">Nenhuma mensagem encontrada</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
            {messages.map((msg) => {
              const isOut = msg.direction === "outbound";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOut ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      isOut
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-secondary-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.message_type === "text" || msg.message_type === "conversation" ? (
                      <p className="leading-snug whitespace-pre-wrap break-words">{msg.content}</p>
                    ) : (
                      <p className="italic opacity-70 text-xs">
                        [{msg.message_type === "image" ? "🖼 Imagem" :
                          msg.message_type === "audio" ? "🎵 Áudio" :
                          msg.message_type === "video" ? "🎬 Vídeo" :
                          msg.message_type === "document" ? "📄 Documento" :
                          `📎 ${msg.message_type}`}]
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

// ─── ReminderCard ─────────────────────────────────────────────────────────────

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
      <CardContent className="p-4 space-y-3">
        {/* Top row: status + instance */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={status} />
          {reminder.instance_name && (
            <Badge
              variant="outline"
              className="gap-1 text-xs border-muted-foreground/25 text-muted-foreground font-normal"
            >
              <Smartphone className="h-3 w-3" />
              {reminder.instance_name}
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto transition-transform group-hover:translate-x-0.5" />
        </div>

        {/* Contact info */}
        <div className="space-y-1">
          {reminder.contact_name && (
            <p className="font-semibold text-sm leading-tight">{reminder.contact_name}</p>
          )}
          {reminder.phone_number && (
            <p className="text-xs text-muted-foreground font-mono">{reminder.phone_number}</p>
          )}
        </div>

        {/* Title */}
        <p className={`text-xs text-muted-foreground line-clamp-1 ${reminder.completed ? "line-through" : ""}`}>
          {reminder.title}
        </p>

        {/* Footer: date + actions */}
        <div
          className="flex items-center justify-between pt-1 border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(reminder.due_date), "dd/MM/yyyy HH:mm")}
          </span>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={reminder.completed}
              onCheckedChange={(checked) => onToggle(reminder.id, !!checked)}
              className="shrink-0"
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Reminders() {
  const [filter, setFilter] = useState<ReminderFilter>("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Reminder | null>(null);

  const { data: reminders = [], isLoading } = useReminders(filter);
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

  const overdueCount = reminders.filter((r) => getReminderStatus(r) === "overdue").length;
  const todayCount = reminders.filter((r) => getReminderStatus(r) === "today").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Lembretes
          </h1>
          <p className="text-muted-foreground text-sm">
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
                placeholder="Título (ex: Vai pagar dia 20)"
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
              <Select
                value={form.instance_name}
                onValueChange={(v) => setForm((p) => ({ ...p, instance_name: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar instância WhatsApp" />
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

      {/* Sumário */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/15 flex items-center justify-center">
              <Clock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-xs text-muted-foreground">Atrasados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/15 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayCount}</p>
              <p className="text-xs text-muted-foreground">Para hoje</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reminders.filter((r) => !r.completed).length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reminders.filter((r) => r.completed).length}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Grid de cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reminders.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum lembrete encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reminders.map((r) => (
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
