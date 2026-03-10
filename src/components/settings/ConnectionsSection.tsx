import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import {
  Loader2,
  Plus,
  Wifi,
  WifiOff,
  Trash2,
  Star,
  Link2,
  ServerCrash,
} from "lucide-react";

export function ConnectionsSection() {
  const {
    instances,
    remoteInstances,
    isLoading,
    isRemoteLoading,
    isServerConnected,
    createInstance,
    connectInstance,
    deleteInstance,
    setActiveInstance,
  } = useWhatsAppInstances();

  const [qrCode, setQrCode] = useState<{ instanceName: string; base64: string } | null>(null);

  const handleCreateInstance = async () => {
    const result = await createInstance.mutateAsync();
    if (result?.qrcode?.base64) {
      setQrCode({ instanceName: result.instanceName, base64: result.qrcode.base64 });
    }
  };

  const handleConnect = async (instanceName: string) => {
    const result = await connectInstance.mutateAsync(instanceName);
    const base64 = result?.qrcode?.base64 || result?.base64;
    if (base64) {
      setQrCode({ instanceName, base64 });
    }
  };

  const handleLinkInstance = async (name: string) => {
    await setActiveInstance.mutateAsync(name);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-500/15 text-green-400 border-green-500/30";
      case "connecting": return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
      default: return "bg-red-500/15 text-red-400 border-red-500/30";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "Conectada";
      case "connecting": return "Conectando";
      default: return "Desconectada";
    }
  };

  // Remote instances not yet linked locally
  const unlinkedRemote = remoteInstances.filter(
    (ri) => !instances.some((i) => i.instance_name === ri.name)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Conexões WhatsApp</h3>
          <p className="text-sm text-muted-foreground">Gerencie suas instâncias do WhatsApp</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Server status indicator */}
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${
              isRemoteLoading ? "bg-yellow-500 animate-pulse" :
              isServerConnected ? "bg-green-500" : "bg-red-500"
            }`} />
            <span className="text-xs text-muted-foreground">
              {isRemoteLoading ? "Verificando..." :
               isServerConnected ? "Servidor online" : "Servidor offline"}
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleCreateInstance}
            disabled={createInstance.isPending || !isServerConnected}
          >
            {createInstance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Nova Instância
          </Button>
        </div>
      </div>

      {/* Server offline warning */}
      {!isServerConnected && !isRemoteLoading && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 flex items-center gap-3">
            <ServerCrash className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Servidor não acessível</p>
              <p className="text-xs text-muted-foreground">
                O backend Evolution API não está respondendo. Verifique se os containers estão rodando na VPS.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && instances.length === 0 && unlinkedRemote.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <WifiOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma instância encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Nova Instância" para criar e conectar seu WhatsApp
            </p>
          </CardContent>
        </Card>
      )}

      {/* Linked instances */}
      {instances.map((inst) => (
        <div
          key={inst.id}
          className={`rounded-xl border p-4 transition-all ${
            inst.is_active ? "border-primary/40 bg-primary/5" : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${
                inst.status === "open" ? "bg-green-500" : inst.status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"
              }`} />
              <span className="font-medium text-sm">{inst.instance_name}</span>
              <Badge variant="outline" className={`text-[10px] ${getStatusColor(inst.status)}`}>
                {getStatusLabel(inst.status)}
              </Badge>
              {inst.is_active && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                  <Star className="h-3 w-3 mr-1" /> Ativa
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {inst.status !== "open" && (
                <Button variant="ghost" size="sm" onClick={() => handleConnect(inst.instance_name)} disabled={connectInstance.isPending} className="text-xs">
                  <Wifi className="h-3.5 w-3.5 mr-1" /> Conectar
                </Button>
              )}
              {!inst.is_active && (
                <Button variant="ghost" size="sm" onClick={() => setActiveInstance.mutate(inst.instance_name)} disabled={setActiveInstance.isPending} className="text-xs">
                  <Star className="h-3.5 w-3.5 mr-1" /> Ativar
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => deleteInstance.mutate(inst.instance_name)} disabled={deleteInstance.isPending} className="text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Unlinked remote instances */}
      {unlinkedRemote.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Instâncias disponíveis no servidor</h4>
          {unlinkedRemote.map((ri) => (
            <div key={ri.name} className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  ri.status === "open" ? "bg-green-500" : "bg-red-500"
                }`} />
                <span className="text-sm">{ri.name}</span>
                {ri.profileName && <span className="text-xs text-muted-foreground">{ri.profileName}</span>}
                <Badge variant="outline" className={`text-[10px] ${getStatusColor(ri.status)}`}>
                  {getStatusLabel(ri.status)}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleLinkInstance(ri.name)}
                disabled={setActiveInstance.isPending}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" /> Vincular
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* QR Code */}
      {qrCode && (
        <Card className="border-primary/30">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium mb-3">
              Escaneie o QR Code para conectar <span className="text-primary">{qrCode.instanceName}</span>
            </p>
            <img
              src={qrCode.base64.startsWith("data:") ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
              alt="QR Code WhatsApp"
              className="mx-auto w-64 h-64 rounded-lg"
            />
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => setQrCode(null)}>
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
