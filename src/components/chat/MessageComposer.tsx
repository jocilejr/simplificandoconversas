import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Paperclip, Send, Loader2, X, Bot } from "lucide-react";
import { uploadMediaFile } from "@/lib/uploadMedia";
import { ManualFlowTrigger } from "@/components/ManualFlowTrigger";

interface Props {
  remoteJid: string;
  instanceName: string;
  disabled?: boolean;
}

export function MessageComposer({ remoteJid, instanceName, disabled }: Props) {
  const { workspaceId, hasPermission } = useWorkspace();
  const canTriggerFlow = hasPermission("disparar_fluxo");
  const [flowOpen, setFlowOpen] = useState(false);
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
    try {
      const body: any = {
        action: "send-message",
        instanceName,
        remoteJid,
        workspaceId,
      };

      if (mediaUrl) {
        body.messageType = mediaKind === "image" ? "image" : "document";
        body.mediaUrl = mediaUrl;
        body.caption = text || undefined;
        body.fileName = mediaName;
      } else {
        body.messageType = "text";
        body.text = text;
      }

      const { error, data } = await supabase.functions.invoke("whatsapp-proxy", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setText("");
      setMediaUrl(null);
      setMediaKind(null);
      setMediaName("");
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-border bg-card/50 p-3">
      {mediaUrl && (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 mb-2 rounded-md bg-muted text-xs">
          <span className="truncate">📎 {mediaName}</span>
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
      <div className="flex items-end gap-2">
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
          className="h-9 w-9 shrink-0"
          onClick={handleAttach}
          disabled={disabled || sending}
          title="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        {canTriggerFlow && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => setFlowOpen(true)}
            disabled={disabled}
            title="Disparar fluxo automatizado"
          >
            <Bot className="h-4 w-4" />
          </Button>
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
          className="min-h-[40px] max-h-[120px] text-xs resize-none flex-1"
          disabled={disabled || sending}
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          className="h-9 shrink-0"
          size="sm"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <ManualFlowTrigger
        open={flowOpen}
        onOpenChange={setFlowOpen}
        defaultPhone={remoteJid?.replace(/@.*/, "")}
        defaultInstance={instanceName || undefined}
      />
    </div>
  );
}
