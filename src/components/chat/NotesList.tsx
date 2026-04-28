import { useState } from "react";
import { useConversationNotes, useCreateNote, useDeleteNote } from "@/hooks/useConversationNotes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function NotesList({ conversationId, remoteJid }: { conversationId: string; remoteJid: string }) {
  const { data: notes = [] } = useConversationNotes(conversationId);
  const createMut = useCreateNote();
  const deleteMut = useDeleteNote();
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleCreate = async () => {
    if (!draft.trim()) return;
    await createMut.mutateAsync({ conversationId, remoteJid, content: draft.trim() });
    setDraft("");
    setExpanded(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
          <StickyNote className="h-3 w-3" /> Notas ({notes.length})
        </span>
        {!expanded && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nova nota..."
            className="min-h-[60px] text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!draft.trim()}>
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setDraft("");
                setExpanded(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 && !expanded ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhuma nota</p>
      ) : (
        <div className="space-y-2 max-h-[220px] overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="bg-muted/50 rounded-md p-2 text-xs group relative">
              <p className="whitespace-pre-wrap break-words pr-5">{n.content}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">
                  {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </span>
                <button
                  onClick={() => deleteMut.mutate({ id: n.id, conversationId })}
                  className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
