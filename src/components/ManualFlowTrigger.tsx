import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Cpu, Phone } from "lucide-react";

interface ManualFlowTriggerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone?: string;
  defaultInstance?: string;
  /** Full remoteJid of the open conversation (e.g. 55119...@s.whatsapp.net or @lid) */
  remoteJid?: string;
}

export function ManualFlowTrigger({ open, onOpenChange, defaultPhone, defaultInstance, remoteJid }: ManualFlowTriggerProps) {
  const { toast } = useToast();
  const { data: flows = [] } = useChatbotFlows();
  const [flowId, setFlowId] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset flow selection when dialog opens
  useEffect(() => {
    if (open) setFlowId("");
  }, [open]);

  const activeFlows = (flows || []).filter((f) => f.active);

  // Determine the target JID for dispatch
  const targetJid = remoteJid?.includes("@s.whatsapp.net")
    ? remoteJid
    : defaultPhone
    ? `${defaultPhone.replace(/\D/g, "")}@s.whatsapp.net`
    : null;

  const isContextLocked = !!(defaultPhone && defaultInstance);

  const handleSubmit = async () => {
    if (!flowId) {
      toast({ title: "Selecione um fluxo", variant: "destructive" });
      return;
    }
    if (!targetJid || !defaultInstance) {
      toast({ title: "Nenhum chat aberto para disparar o fluxo", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("execute-flow", {
        body: { flowId, remoteJid: targetJid, instanceName: defaultInstance },
      });
      if (error) throw error;
      toast({ title: "Fluxo disparado com sucesso!" });
      onOpenChange(false);
      setFlowId("");
    } catch (err: any) {
      toast({ title: "Erro ao disparar fluxo", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disparar Fluxo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isContextLocked && (
            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Enviando para</p>
              <div className="flex items-center gap-2 flex-wrap">
                {defaultPhone && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Phone className="h-3 w-3" />
                    {defaultPhone}
                  </Badge>
                )}
                {defaultInstance && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Cpu className="h-3 w-3" />
                    {defaultInstance}
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Fluxo</Label>
            <Select value={flowId} onValueChange={setFlowId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fluxo" />
              </SelectTrigger>
              <SelectContent>
                {activeFlows.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !flowId}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Disparar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
