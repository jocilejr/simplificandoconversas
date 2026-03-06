import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import {
  Loader2,
  Plus,
  Wifi,
  WifiOff,
  Trash2,
  Star,
  RefreshCw,
  Search,
  Link2,
} from "lucide-react";

export function ConnectionsSection() {
  const {
    instances,
    fetchRemoteInstances,
    createInstance,
    connectInstance,
    deleteInstance,
    setActiveInstance,
  } = useEvolutionInstances();

  const [showBrowseDialog, setShowBrowseDialog] = useState(false);
  const [qrCode, setQrCode] = useState<{ instanceName: string; base64: string } | null>(null);
  const [remoteInstances, setRemoteInstances] = useState<any[]>([]);

  // Auto-fetch remote instances to get real connection status
  useEffect(() => {
    if (instances.length > 0) {
      fetchRemoteInstances.mutateAsync().then((result) => {
        if (Array.isArray(result)) setRemoteInstances(result);
        else if (result?.instances) setRemoteInstances(result.instances);
      }).catch(() => {});
    }
  }, [instances.length]);

  const handleFetchInstances = async () => {
    const result = await fetchRemoteInstances.mutateAsync();
    if (Array.isArray(result)) setRemoteInstances(result);
    else if (result?.instances) setRemoteInstances(result.instances);
  };

  const handleCreateInstance = async () => {
    const result = await createInstance.mutateAsync();
    if (result?.qrcode?.base64) {
      setQrCode({ instanceName: result.instanceName, base64: result.qrcode.base64 });
      setShowBrowseDialog(false);
    }
  };

  const handleConnect = async (instanceName: string) => {
    const result = await connectInstance.mutateAsync(instanceName);
    if (result?.base64) {
      setQrCode({ instanceName, base64: result.base64 });
    }
  };

  const handleLinkInstance = async (name: string) => {
    await setActiveInstance.mutateAsync(name);
    setShowBrowseDialog(false);
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

  const linkedInstances = instances.map(i => {
    const remote = remoteInstances.find((ri: any) => (ri.name || ri.instanceName || ri.instance?.instanceName) === i.instance_name);
    const status = remote ? (remote.connectionStatus || remote.instance?.state || remote.state || i.status) : i.status;
    return { ...i, status };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Instâncias WhatsApp</h3>
          <p className="text-sm text-muted-foreground">Suas conexões WhatsApp vinculadas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Browse / Link Dialog */}
          <Dialog open={showBrowseDialog} onOpenChange={setShowBrowseDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Buscar Instâncias
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Instâncias no Servidor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchInstances}
                    disabled={fetchRemoteInstances.isPending}
                  >
                    {fetchRemoteInstances.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Atualizar Lista
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateInstance}
                    disabled={createInstance.isPending}
                  >
                    {createInstance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Nova Instância
                  </Button>
                </div>

                {remoteInstances.length === 0 && !fetchRemoteInstances.isPending && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Clique em "Atualizar Lista" para buscar instâncias do servidor
                  </div>
                )}

                {fetchRemoteInstances.isPending && (
                  <div className="text-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                )}

                {remoteInstances.map((ri: any) => {
                  const name = ri.name || ri.instanceName || ri.instance?.instanceName;
                  const status = ri.connectionStatus || ri.instance?.state || ri.state || "close";
                  const isLinked = instances.some(i => i.instance_name === name);
                  const profileName = ri.profileName || "";

                  return (
                    <div key={name} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          status === "open" ? "bg-green-500" : status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{name}</p>
                          {profileName && <p className="text-xs text-muted-foreground">{profileName}</p>}
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${getStatusColor(status)}`}>
                          {getStatusLabel(status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {isLinked ? (
                          <Badge variant="secondary" className="text-[10px]">Vinculada</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleLinkInstance(name)}
                            disabled={setActiveInstance.isPending}
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1" />
                            Vincular
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={() => deleteInstance.mutate(name)}
                          disabled={deleteInstance.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Empty state */}
      {linkedInstances.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <WifiOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma instância vinculada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Buscar Instâncias" para vincular ou criar uma nova
            </p>
          </CardContent>
        </Card>
      )}

      {linkedInstances.map((inst) => (
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

      {/* QR Code */}
      {qrCode && (
        <Card className="border-primary/30">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium mb-3">
              Escaneie o QR Code para conectar <span className="text-primary">{qrCode.instanceName}</span>
            </p>
            <img
              src={qrCode.base64.startsWith("data:") ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
              alt="QR Code"
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
