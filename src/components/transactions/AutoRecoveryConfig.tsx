import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings2, Loader2, Zap, Clock, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { useRecoverySettings, useRecoveryQueue } from "@/hooks/useRecoverySettings";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

export function AutoRecoveryToggle() {
  const { settings, isLoading, upsert } = useRecoverySettings();
  const [configOpen, setConfigOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const enabled = (settings as any)?.enabled ?? false;

  const handleToggle = (checked: boolean) => {
    upsert.mutate({ enabled: checked }, {
      onSuccess: () => toast.success(checked ? "Recuperação automática ativada" : "Recuperação automática desativada"),
      onError: () => toast.error("Erro ao atualizar"),
    });
  };

  if (isLoading) return null;

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Zap className={`h-3.5 w-3.5 ${enabled ? "text-green-500" : "text-muted-foreground"}`} />
              <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={upsert.isPending}
                className="scale-90"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Recuperação automática {enabled ? "ativa" : "desativada"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setConfigOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Configurar recuperação automática</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setQueueOpen(true)}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver fila de envios</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AutoRecoveryConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
      <RecoveryQueueDialog open={queueOpen} onOpenChange={setQueueOpen} />
    </div>
  );
}

function AutoRecoveryConfigDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { settings, upsert } = useRecoverySettings();
  const { instances } = useWhatsAppInstances();

  const [delaySeconds, setDelaySeconds] = useState(20);
  const [sendAfterMinutes, setSendAfterMinutes] = useState(5);
  const [instanceBoleto, setInstanceBoleto] = useState("");
  const [instancePix, setInstancePix] = useState("");
  const [instanceYampi, setInstanceYampi] = useState("");

  useEffect(() => {
    if (open && settings) {
      const s = settings as any;
      setDelaySeconds(s.delay_seconds || 20);
      setSendAfterMinutes(s.send_after_minutes || 5);
      setInstanceBoleto(s.instance_boleto || "");
      setInstancePix(s.instance_pix || "");
      setInstanceYampi(s.instance_yampi || "");
    }
  }, [open, settings]);

  const activeInstances = (instances || []).filter((i: any) => i.is_active);

  const handleSave = () => {
    if (delaySeconds < 20) {
      toast.error("O delay mínimo é de 20 segundos");
      return;
    }
    upsert.mutate({
      delay_seconds: delaySeconds,
      send_after_minutes: sendAfterMinutes,
      instance_boleto: instanceBoleto || null,
      instance_pix: instancePix || null,
      instance_yampi: instanceYampi || null,
      instance_name: instanceBoleto || instancePix || instanceYampi || null,
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
            Recuperação Automática
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Instância por tipo de transação
            </Label>

            {[
              { label: "Boletos", value: instanceBoleto, setter: setInstanceBoleto },
              { label: "PIX / Cartão", value: instancePix, setter: setInstancePix },
              { label: "Carrinhos Yampi", value: instanceYampi, setter: setInstanceYampi },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-sm min-w-[110px]">{item.label}</span>
                <Select value={item.value} onValueChange={item.setter}>
                  <SelectTrigger className="flex-1 h-8 text-sm">
                    <SelectValue placeholder="Selecionar..." />
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
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Delay entre mensagens
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={20}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">seg</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Espera antes de enviar
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={sendAfterMinutes}
                  onChange={(e) => setSendAfterMinutes(Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">min</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            A mensagem enviada será a mesma configurada no ⚙️ de cada aba (Boletos, PIX/Cartão).
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

const queueStatusStyles: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  sent: "bg-green-500/20 text-green-600 border-green-500/30",
  failed: "bg-destructive/20 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const queueStatusLabels: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

function RecoveryQueueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { queue, isLoading, refetch, cancelItem } = useRecoveryQueue();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-primary" />
            Fila de Recuperação
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => refetch()}>
              Atualizar
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto max-h-[60vh]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : queue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Fila vazia</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 sticky top-0">
                <tr>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Valor</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Agendado</th>
                  <th className="text-center p-2 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-center p-2 text-xs font-semibold text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {queue.map((item: any) => (
                  <tr key={item.id} className="hover:bg-secondary/20">
                    <td className="p-2">
                      <div>
                        <p className="font-medium truncate max-w-[120px]">{item.customer_name || "-"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.customer_phone}</p>
                      </div>
                    </td>
                    <td className="p-2 text-xs">{item.transaction_type}</td>
                    <td className="p-2 text-xs font-medium">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.amount)}
                    </td>
                    <td className="p-2 text-xs">
                      {new Date(item.scheduled_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={`text-[10px] ${queueStatusStyles[item.status] || ""}`}>
                        {queueStatusLabels[item.status] || item.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-center">
                      {item.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-destructive hover:text-destructive"
                          onClick={() => cancelItem.mutate(item.id)}
                          disabled={cancelItem.isPending}
                        >
                          Cancelar
                        </Button>
                      )}
                      {item.status === "failed" && item.error_message && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-destructive cursor-help">Erro</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">{item.error_message}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
