import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, Clock } from "lucide-react";
import { toast } from "sonner";
import { useFollowUpSettings } from "@/hooks/useFollowUpSettings";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function FollowUpSettingsDialog({ open, onOpenChange }: Props) {
  const { settings, upsert } = useFollowUpSettings();
  const { instances } = useWhatsAppInstances();

  const [enabled, setEnabled] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [sendAtHour, setSendAtHour] = useState("09:00");

  useEffect(() => {
    if (open && settings) {
      setEnabled(settings.enabled ?? false);
      setInstanceName(settings.instance_name || "");
      setSendAtHour((settings as any).send_at_hour || "09:00");
    }
  }, [open, settings]);

  const activeInstances = (instances || []).filter((i: any) => i.is_active);

  const handleSave = () => {
    upsert.mutate({
      enabled,
      instance_name: instanceName || null,
      send_at_hour: sendAtHour,
    } as any, {
      onSuccess: () => {
        toast.success("Configurações salvas!");
        onOpenChange(false);
      },
      onError: () => toast.error("Erro ao salvar"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Follow Up Automático
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Ativar envio automático</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Instância WhatsApp
            </Label>
            <Select value={instanceName} onValueChange={setInstanceName}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecionar instância..." />
              </SelectTrigger>
              <SelectContent>
                {activeInstances.map((inst: any) => (
                  <SelectItem key={inst.instance_name} value={inst.instance_name}>
                    {inst.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" /> Horário de disparo diário
            </Label>
            <Input
              type="time"
              value={sendAtHour}
              onChange={(e) => setSendAtHour(e.target.value)}
              className="h-8 text-sm w-32"
            />
            <p className="text-[11px] text-muted-foreground">
              O follow up será enviado uma vez por dia neste horário (horário de Brasília)
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            O intervalo entre mensagens é definido na Fila de Mensagens em ⚙️ Configurações &gt; Conexões.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
