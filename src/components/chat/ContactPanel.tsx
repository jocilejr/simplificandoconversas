import { ChatConversation } from "@/hooks/useConversationsLive";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LabelManager } from "./LabelManager";
import { CrossInstanceHistory } from "./CrossInstanceHistory";
import { ContactReminders } from "./ContactReminders";
import { Phone, Cpu } from "lucide-react";

interface Props {
  conversation: ChatConversation;
  onSelectConversation?: (conversationId: string) => void;
}

const INSTANCE_HUES = [210, 280, 150, 25, 340, 190, 55, 320];
function instanceColor(name: string | null | undefined): string {
  if (!name) return "hsl(215 10% 50%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = INSTANCE_HUES[Math.abs(hash) % INSTANCE_HUES.length];
  return `hsl(${hue} 65% 55%)`;
}

export function ContactPanel({ conversation, onSelectConversation }: Props) {
  const display = conversation.contact_name || conversation.phone_number || conversation.remote_jid;
  const initials = display.slice(0, 2).toUpperCase();
  const instColor = instanceColor(conversation.instance_name);

  return (
    <div className="h-full flex flex-col border-l border-border bg-card/30">
      <div className="p-4 border-b border-border flex flex-col items-center text-center space-y-2">
        <Avatar className="h-16 w-16 ring-2 ring-border">
          <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 w-full">
          <h3 className="text-sm font-semibold truncate">{display}</h3>
          {conversation.phone_number && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" />
              {conversation.phone_number}
            </p>
          )}
          {conversation.instance_name && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1.5"
              style={{
                background: instColor.replace("55%)", "15%)"),
                color: instColor,
              }}
            >
              <Cpu className="h-2.5 w-2.5" strokeWidth={2.5} />
              {conversation.instance_name}
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <LabelManager conversationId={conversation.id} />

          <Separator />
          <CrossInstanceHistory
            currentConversationId={conversation.id}
            currentInstance={conversation.instance_name}
            remoteJid={conversation.remote_jid}
            phoneNumber={conversation.phone_number}
            onSelectConversation={onSelectConversation}
          />

          <Separator />
          <ContactReminders
            conversationId={conversation.id}
            remoteJid={conversation.remote_jid}
            instanceName={conversation.instance_name}
            contactName={conversation.contact_name}
            phone={conversation.phone_number}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
