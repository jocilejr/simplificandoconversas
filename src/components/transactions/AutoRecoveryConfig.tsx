import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings2, Loader2, Zap, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { useRecoverySettings, useRecoveryQueue } from "@/hooks/useRecoverySettings";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { normalizePhone } from "@/lib/normalizePhone";

export function AutoRecoveryToggle() {
  const { settings, isLoading, upsert } = useRecoverySettings();
  const [configOpen, setConfigOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const s = settings as any;
  const enabledBoleto = s?.enabled_boleto ?? false;
  const enabledPix = s?.enabled_pix ?? false;
  const enabledYampi = s?.enabled_yampi ?? false;
  const anyEnabled = enabledBoleto || enabledPix || enabledYampi;

  if (isLoading) return null;

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Zap className={`h-3.5 w-3.5 ${anyEnabled ? "text-green-500" : "text-muted-foreground"}`} />
              <span className="text-[10px] text-muted-foreground">
                {anyEnabled ? "Auto" : "Off"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Recuperação automática: {[
              enabledBoleto && "Boleto",
              enabledPix && "PIX/Cartão",
              enabledYampi && "Yampi",
            ].filter(Boolean).join(", ") || "desativada"}</p>
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

  const [instanceBoleto, setInstanceBoleto] = useState("");
  const [instancePix, setInstancePix] = useState("");
  const [instanceYampi, setInstanceYampi] = useState("");
  const [enabledBoleto, setEnabledBoleto] = useState(false);
  const [enabledPix, setEnabledPix] = useState(false);
  const [enabledYampi, setEnabledYampi] = useState(false);

  useEffect(() => {
    if (open && settings) {
      const s = settings as any;
      setInstanceBoleto(s.instance_boleto || "");
      setInstancePix(s.instance_pix || "");
      setInstanceYampi(s.instance_yampi || "");
      setEnabledBoleto(s.enabled_boleto ?? false);
      setEnabledPix(s.enabled_pix ?? false);
      setEnabledYampi(s.enabled_yampi ?? false);
    }
  }, [open, settings]);

  const activeInstances = (instances || []).filter((i: any) => i.is_active);

  const handleSave = () => {
    upsert.mutate({
      instance_boleto: instanceBoleto || null,
      instance_pix: instancePix || null,
      instance_yampi: instanceYampi || null,
      enabled_boleto: enabledBoleto,
      enabled_pix: enabledPix,
      enabled_yampi: enabledYampi,
      enabled: enabledBoleto || enabledPix || enabledYampi,
    } as any, {
      onSuccess: () => {
        toast.success("Configurações salvas!");
        onOpenChange(false);
      },
      onError: () => toast.error("Erro ao salvar"),
    });
  };

  const typeRows = [
    { label: "Boletos", value: instanceBoleto, setter: setInstanceBoleto, enabled: enabledBoleto, setEnabled: setEnabledBoleto },
    { label: "PIX / Cartão", value: instancePix, setter: setInstancePix, enabled: enabledPix, setEnabled: setEnabledPix },
    { label: "Rejeitados/Abandonados", value: instanceYampi, setter: setInstanceYampi, enabled: enabledYampi, setEnabled: setEnabledYampi },
  ];

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
              Ativar e configurar por tipo
            </Label>

            {typeRows.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <Switch
                  checked={item.enabled}
                  onCheckedChange={item.setEnabled}
                  className="scale-75"
                />
                <span className="text-sm min-w-[110px]">{item.label}</span>
                <Select value={item.value} onValueChange={item.setter}>
                  <SelectTrigger className="flex-1 h-8 text-sm">
                    <SelectValue placeholder="Instância..." />
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

          <p className="text-xs text-muted-foreground">
            A mensagem enviada será a mesma configurada no ⚙️ de cada aba. O intervalo entre mensagens é definido na Fila de Mensagens em Configurações &gt; Conexões.
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
