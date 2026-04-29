import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCreateReminder, useToggleReminder, useDeleteReminder, Reminder } from "@/hooks/useReminders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  conversationId: string;
  remoteJid: string;
  instanceName: string | null;
  contactName: string | null;
  phone: string | null;
}

export function ContactReminders({ remoteJid, instanceName, contactName, phone }: Props) {
  const { workspaceId } = useWorkspace();
  const createMut = useCreateReminder();
  const toggleMut = useToggleReminder();
  const deleteMut = useDeleteReminder();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["contact-reminders", workspaceId, remoteJid],
    enabled: !!workspaceId && !!remoteJid,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reminders")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("remote_jid", remoteJid)
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data || []) as Reminder[];
    },
  });

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createMut.mutateAsync({
      remote_jid: remoteJid,
      instance_name: instanceName || undefined,
      contact_name: contactName || undefined,
      phone_number: phone || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: new Date(dueDate).toISOString(),
    });
    setTitle("");
    setDescription("");
    setExpanded(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
          <Bell className="h-3 w-3" /> Lembretes ({reminders.length})
        </span>
        {!expanded && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2 p-2 border border-border rounded-md">
          <Input
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-7 text-xs"
          />
          <Textarea
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[50px] text-xs"
          />
          <Input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!title.trim()}>
              Criar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setExpanded(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {reminders.length === 0 && !expanded ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhum lembrete</p>
      ) : (
        <div className="space-y-1.5 overflow-hidden">
          {reminders.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-2 p-1.5 rounded-md bg-muted/50 text-xs group overflow-hidden"
            >
              <Checkbox
                checked={r.completed}
                onCheckedChange={(v) => toggleMut.mutate({ id: r.id, completed: !!v })}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${r.completed ? "line-through text-muted-foreground" : ""}`}>
                  {r.title.length > 30 ? r.title.slice(0, 30) + "…" : r.title}
                </p>
                <span className="text-[9px] text-muted-foreground">
                  {format(new Date(r.due_date), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </div>
              <button
                onClick={() => deleteMut.mutate(r.id)}
                className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
