import { useState } from "react";
import { ChatConversation } from "@/hooks/useConversationsLive";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LabelManager } from "./LabelManager";
import { NotesList } from "./NotesList";
import { ContactReminders } from "./ContactReminders";
import { ManualFlowTrigger } from "@/components/ManualFlowTrigger";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Zap, Phone, Cpu } from "lucide-react";

export function ContactPanel({ conversation }: { conversation: ChatConversation }) {
  const { hasPermission } = useWorkspace();
  const canTriggerFlow = hasPermission("disparar_fluxo");
  const [flowOpen, setFlowOpen] = useState(false);

  const display = conversation.contact_name || conversation.phone_number || conversation.remote_jid;
  const initials = display.slice(0, 2).toUpperCase();

  return (
    <div className="h-full flex flex-col border-l border-border bg-card/30">
      <div className="p-4 border-b border-border flex flex-col items-center text-center space-y-2">
        <Avatar className="h-16 w-16">
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
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
              <Cpu className="h-3 w-3" />
              {conversation.instance_name}
            </p>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {canTriggerFlow && (
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setFlowOpen(true)}
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              Disparar Fluxo
            </Button>
          )}

          <Separator />
          <LabelManager conversationId={conversation.id} />

          <Separator />
          <NotesList
            conversationId={conversation.id}
            remoteJid={conversation.remote_jid}
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

      <ManualFlowTrigger
        open={flowOpen}
        onOpenChange={setFlowOpen}
        defaultPhone={conversation.phone_number || conversation.remote_jid.replace(/@.*/, "")}
        defaultInstance={conversation.instance_name || undefined}
      />
    </div>
  );
}
