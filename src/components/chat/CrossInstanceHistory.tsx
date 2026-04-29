import { useCrossInstanceConversations } from "@/hooks/useCrossInstanceConversations";
import { Cpu, MessagesSquare } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

function truncateMessage(text: string | null | undefined, max: number = 28): string {
  if (!text) return "—";
  const flat = text.split("\n").join(" ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

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
    currentInstance,
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
        <div className="space-y-1.5 overflow-hidden">
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
                  "w-full text-left rounded-md border border-border bg-background/40 overflow-hidden",
                  "hover:bg-accent/40 hover:border-primary/30 transition-colors p-1.5 group"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold min-w-0 overflow-hidden max-w-[55%]"
                    style={{
                      background: color.replace("55%)", "15%)"),
                      color: color,
                    }}
                  >
                    <Cpu className="h-2.5 w-2.5" strokeWidth={2.5} />
                    <span className="truncate">{c.instance_name ? (c.instance_name.length > 18 ? c.instance_name.slice(0, 18) + "…" : c.instance_name) : "—"}</span>
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
                  {c.last_message ? truncateMessage(c.last_message) : <span className="italic text-muted-foreground">sem mensagens</span>}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
