import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ManualFlowTriggerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualFlowTrigger({ open, onOpenChange }: ManualFlowTriggerProps) {
  const { toast } = useToast();
  const { data: flows = [] } = useChatbotFlows();
  const { instances = [] } = useEvolutionInstances();

  const [phone, setPhone] = useState("");
  const [flowId, setFlowId] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [loading, setLoading] = useState(false);

  const activeFlows = (flows || []).filter((f) => f.active);

  const handleSubmit = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (!cleaned || !flowId || !instanceName) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const remoteJid = `${cleaned}@s.whatsapp.net`;
      const { error } = await supabase.functions.invoke("execute-flow", {
        body: { flowId, remoteJid, instanceName },
      });
      if (error) throw error;
      toast({ title: "Fluxo disparado com sucesso!" });
      onOpenChange(false);
      setPhone("");
      setFlowId("");
      setInstanceName("");
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
          <div className="space-y-2">
            <Label>Número (com DDD)</Label>
            <Input
              placeholder="5588999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

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

          <div className="space-y-2">
            <Label>Instância</Label>
            <Select value={instanceName} onValueChange={setInstanceName}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((i) => (
                  <SelectItem key={i.id} value={i.instance_name}>
                    {i.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Disparar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
