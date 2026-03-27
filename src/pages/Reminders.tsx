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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Plus, Trash2, Calendar, Clock, CheckCircle2, Smartphone } from "lucide-react";
import {
  useReminders,
  useCreateReminder,
  useToggleReminder,
  useDeleteReminder,
  type ReminderFilter,
  type Reminder,
} from "@/hooks/useReminders";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

function getReminderStatus(r: Reminder): "overdue" | "today" | "upcoming" | "completed" {
  if (r.completed) return "completed";
  const due = new Date(r.due_date);
  const now = new Date();
  if (isBefore(due, startOfDay(now))) return "overdue";
  if (isToday(due)) return "today";
  return "upcoming";
}

function StatusBadge({ status }: { status: ReturnType<typeof getReminderStatus> }) {
  const map = {
    overdue: { label: "Atrasado", className: "bg-destructive/20 text-destructive border-destructive/30" },
    today: { label: "Hoje", className: "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30" },
    upcoming: { label: "Futuro", className: "bg-primary/20 text-primary border-primary/30" },
    completed: { label: "Concluído", className: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status];
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

export default function Reminders() {
  const [filter, setFilter] = useState<ReminderFilter>("pending");
  const [dialogOpen, setDialogOpen] = useState(false);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Lembretes
          </h1>
          <p className="text-muted-foreground">
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

      {/* Summary cards */}
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
            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--warning))]/15 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-[hsl(var(--warning))]" />
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

      {/* Filter tabs */}
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

      {/* List */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : reminders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum lembrete encontrado
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reminders.map((r) => {
                const status = getReminderStatus(r);
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-4 p-4 transition-colors hover:bg-secondary/40 ${
                      r.completed ? "opacity-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={r.completed}
                      onCheckedChange={(checked) =>
                        toggleReminder.mutate({ id: r.id, completed: !!checked })
                      }
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium text-sm ${r.completed ? "line-through" : ""}`}>
                          {r.title}
                        </span>
                        <StatusBadge status={status} />
                        {r.instance_name && (
                          <Badge
                            variant="outline"
                            className="gap-1 text-xs border-muted-foreground/30 text-muted-foreground font-normal"
                          >
                            <Smartphone className="h-3 w-3" />
                            {r.instance_name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {r.contact_name && <span>{r.contact_name}</span>}
                        {r.phone_number && <span>{r.phone_number}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(r.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{r.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteReminder.mutate(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
