import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { useQueryClient } from "@tanstack/react-query";
import { ChatMessage } from "@/hooks/useMessagesLive";
import { Paperclip, Send, Loader2, X, Bot } from "lucide-react";
import { uploadMediaFile } from "@/lib/uploadMedia";

interface Props {
  remoteJid: string;
  instanceName: string;
  conversationId?: string;
  disabled?: boolean;
}

export function MessageComposer({ remoteJid, instanceName, conversationId, disabled }: Props) {
  const { workspaceId, hasPermission } = useWorkspace();
  const canTriggerFlow = hasPermission("disparar_fluxo");
  const { data: flows = [] } = useChatbotFlows();
  const activeFlows = (flows || []).filter((f: any) => f.active);
  const qc = useQueryClient();

  const [flowPopoverOpen, setFlowPopoverOpen] = useState(false);
  const [triggeringFlowId, setTriggeringFlowId] = useState<string | null>(null);
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "document" | null>(null);
  const [mediaName, setMediaName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = (!!text.trim() || !!mediaUrl) && !!remoteJid && !!instanceName && !disabled && !sending;

  const handleAttach = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSending(true);
      const url = await uploadMediaFile(file);
      setMediaUrl(url);
      setMediaKind(file.type.startsWith("image/") ? "image" : "document");
      setMediaName(file.name);
    } catch (err: any) {
      toast({ title: "Falha ao enviar mídia", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);

    const currentText = text;
    const currentMediaUrl = mediaUrl;
    const currentMediaKind = mediaKind;
    const currentMediaName = mediaName;

    // Clear form immediately
    setText("");
    setMediaUrl(null);
    setMediaKind(null);
    setMediaName("");

    // Optimistic message insert
    const optimisticId = `optimistic-${Date.now()}`;
    if (conversationId) {
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        conversation_id: conversationId,
        content: currentMediaUrl ? (currentText || null) : currentText,
        message_type: currentMediaUrl
          ? currentMediaKind === "image"
            ? "image"
            : "document"
          : "text",
        direction: "outbound",
        status: "sending",
        media_url: currentMediaUrl,
        transcription: null,
        created_at: new Date().toISOString(),
        external_id: null,
      };
      qc.setQueryData(
        ["chat-messages", conversationId],
        (old: ChatMessage[] = []) => [...old, optimisticMsg]
      );
    }

    try {
      const body: any = {
        action: "send-message",
        instanceName,
        remoteJid,
        workspaceId,
      };

      if (currentMediaUrl) {
        body.messageType = currentMediaKind === "image" ? "image" : "document";
        body.mediaUrl = currentMediaUrl;
        body.message = currentText || undefined;
        body.fileName = currentMediaName;
      } else {
        body.messageType = "text";
        body.message = currentText;
      }

      const { error, data } = await supabase.functions.invoke("whatsapp-proxy", { body });
      if (error) {
        // Extract real error message from response body
        let msg = error.message || "Erro ao enviar mensagem";
        try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
    } catch (err: any) {
      // Rollback optimistic message and restore form
      if (conversationId) {
        qc.setQueryData(
          ["chat-messages", conversationId],
          (old: ChatMessage[] = []) => old.filter((m) => m.id !== optimisticId)
        );
      }
      setText(currentText);
      setMediaUrl(currentMediaUrl);
      setMediaKind(currentMediaKind);
      setMediaName(currentMediaName);
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleTriggerFlow = async (flowId: string) => {
    if (!remoteJid || !instanceName) {
      toast({ title: "Nenhum chat aberto", variant: "destructive" });
      return;
    }
    setTriggeringFlowId(flowId);
    setFlowPopoverOpen(false);
    try {
      const { error } = await supabase.functions.invoke("execute-flow", {
        body: { flowId, remoteJid, instanceName },
      });
      if (error) throw error;
      toast({ title: "Fluxo disparado!" });
    } catch (err: any) {
      toast({ title: "Erro ao disparar fluxo", description: err.message, variant: "destructive" });
    } finally {
      setTriggeringFlowId(null);
    }
  };

  return (
    <div className="border-t border-border bg-card/40 px-3 py-2.5 shrink-0">
      {mediaUrl && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 mb-2 rounded-md bg-muted/70 text-xs border border-border">
          <span className="truncate flex items-center gap-1.5">
            <Paperclip className="h-3 w-3 shrink-0" />
            {mediaName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => {
              setMediaUrl(null);
              setMediaKind(null);
              setMediaName("");
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFile}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full hover:bg-accent"
          onClick={handleAttach}
          disabled={disabled || sending}
          title="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        {canTriggerFlow && (
          <Popover open={flowPopoverOpen} onOpenChange={setFlowPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full text-primary hover:text-primary hover:bg-primary/10"
                disabled={disabled || !!triggeringFlowId}
                title="Disparar fluxo automatizado"
              >
                {triggeringFlowId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-56 p-1"
              sideOffset={6}
            >
              {activeFlows.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-2">Nenhum fluxo ativo</p>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
                    Disparar fluxo
                  </p>
                  {activeFlows.map((f: any) => (
                    <button
                      key={f.id}
                      onClick={() => handleTriggerFlow(f.id)}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <Bot className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={disabled ? "Selecione uma conversa" : "Digite uma mensagem..."}
          rows={1}
          className="min-h-10 h-10 max-h-32 text-sm resize-none flex-1 py-2.5 px-3 rounded-full bg-background border-border focus-visible:ring-1 focus-visible:ring-primary/40 leading-tight"
          disabled={disabled || sending}
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          title="Enviar"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
