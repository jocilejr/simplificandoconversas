import { useCrossInstanceConversations } from "@/hooks/useCrossInstanceConversations";
import { Cpu, MessagesSquare, ArrowRight } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const INSTANCE_HUES = [210, 280, 150, 25, 340, 190, 55, 320];
function instanceColor(name: string | null | undefined): string {
  if (!name) return "hsl(215 10% 50%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = INSTANCE_HUES[Math.abs(hash) % INSTANCE_HUES.length];
  return `hsl(${hue} 65% 55%)`;
}

interface Props {
  currentConversationId: string;
  currentInstance: string | null;
  remoteJid: string;
  phoneNumber: string | null;
  onSelectConversation?: (conversationId: string) => void;
}

export function CrossInstanceHistory({
  currentConversationId,
  currentInstance,
  remoteJid,
  phoneNumber,
  onSelectConversation,
}: Props) {
  const { data: others = [], isLoading } = useCrossInstanceConversations({
    currentConversationId,
    remoteJid,
    phoneNumber,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
          <MessagesSquare className="h-3 w-3" /> Em outras instâncias ({others.length})
        </span>
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground italic">Carregando...</p>
      ) : others.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          Este contato existe apenas em {currentInstance || "esta instância"}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
          {others.map((c) => {
            const color = instanceColor(c.instance_name);
            const timeAgo = c.last_message_at
              ? formatDistanceToNowStrict(new Date(c.last_message_at), {
                  locale: ptBR,
                  addSuffix: false,
                })
              : "";
            return (
              <button
                key={c.id}
                onClick={() => onSelectConversation?.(c.id)}
                className={cn(
                  "w-full text-left rounded-md border border-border bg-background/40",
                  "hover:bg-accent/40 hover:border-primary/30 transition-colors p-2 group"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                    style={{
                      background: color.replace("55%)", "15%)"),
                      color: color,
                    }}
                  >
                    <Cpu className="h-2.5 w-2.5" strokeWidth={2.5} />
                    {c.instance_name || "—"}
                  </span>
                  <div className="flex items-center gap-1">
                    {c.unread_count > 0 && (
                      <span className="text-[9px] bg-primary text-primary-foreground rounded-full px-1.5 min-w-[16px] text-center">
                        {c.unread_count}
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground tabular-nums">{timeAgo}</span>
                  </div>
                </div>
                <p className="text-[11px] text-foreground/80 truncate">
                  {c.last_message || <span className="italic text-muted-foreground">sem mensagens</span>}
                </p>
                <div className="flex items-center justify-end mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] text-primary flex items-center gap-0.5">
                    Abrir <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
