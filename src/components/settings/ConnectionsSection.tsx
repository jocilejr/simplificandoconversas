import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/useProfile";
import { useEvolutionInstances } from "@/hooks/useEvolutionInstances";
import {
  Loader2,
  Plus,
  Wifi,
  WifiOff,
  Trash2,
  Star,
  RefreshCw,
  Shield,
  Settings2,
  Search,
  Link2,
} from "lucide-react";

export function ConnectionsSection() {
  const { profile, updateProfile } = useProfile();
  const {
    instances,
    fetchRemoteInstances,
    createInstance,
    connectInstance,
    deleteInstance,
    setActiveInstance,
    setProxy,
  } = useEvolutionInstances();

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [showBrowseDialog, setShowBrowseDialog] = useState(false);
  const [qrCode, setQrCode] = useState<{ instanceName: string; base64: string } | null>(null);
  const [remoteInstances, setRemoteInstances] = useState<any[]>([]);
  const [proxyInputs, setProxyInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setApiUrl(profile.evolution_api_url || "");
      setApiKey(profile.evolution_api_key || "");
    }
  }, [profile]);

  const handleSaveCredentials = () => {
    updateProfile.mutate({ evolution_api_url: apiUrl, evolution_api_key: apiKey });
  };

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

  const handleSetProxy = (instanceName: string) => {
    const url = proxyInputs[instanceName];
    if (url !== undefined) setProxy.mutate({ instanceName, proxyUrl: url });
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

  // Linked instances = instances from local DB (the ones the user has linked)
  const linkedInstances = instances.map(i => {
    const remote = remoteInstances.find((ri: any) => (ri.name || ri.instanceName || ri.instance?.instanceName) === i.instance_name);
    const status = remote ? (remote.connectionStatus || remote.instance?.state || remote.state || i.status) : i.status;
    return { ...i, status };
  });

  const hasCredentials = !!(profile?.evolution_api_url && profile?.evolution_api_key);

  return (
    <div className="space-y-6">
      {/* Header with config gear */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Instâncias WhatsApp</h3>
          <p className="text-sm text-muted-foreground">Suas conexões WhatsApp vinculadas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Browse / Link Dialog */}
          <Dialog open={showBrowseDialog} onOpenChange={setShowBrowseDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!hasCredentials}>
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

          {/* Server Config Gear */}
          <Dialog open={showServerConfig} onOpenChange={setShowServerConfig}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Settings2 className="h-4.5 w-4.5 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Servidor Evolution API</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>URL Base</Label>
                  <Input
                    placeholder="https://sua-instancia.evolution-api.com"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key Global</Label>
                  <Input
                    type="password"
                    placeholder="Sua API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <Button onClick={handleSaveCredentials} disabled={updateProfile.isPending} className="w-full">
                  {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar Credenciais
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* No credentials warning */}
      {!hasCredentials && (
        <Card className="border-dashed border-warning/40 bg-warning/5">
          <CardContent className="py-6 text-center">
            <Settings2 className="h-8 w-8 mx-auto mb-2 text-warning/60" />
            <p className="text-sm text-muted-foreground">
              Configure as credenciais do servidor Evolution API clicando no ícone de engrenagem acima
            </p>
          </CardContent>
        </Card>
      )}

      {/* Linked instances list */}
      {hasCredentials && linkedInstances.length === 0 && (
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
          <div className="flex items-center justify-between mb-3">
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

          {/* Proxy */}
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Proxy (opcional): http://user:pass@host:port"
              className="h-8 text-xs"
              value={proxyInputs[inst.instance_name] ?? inst.proxy_url ?? ""}
              onChange={(e) => setProxyInputs(prev => ({ ...prev, [inst.instance_name]: e.target.value }))}
            />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSetProxy(inst.instance_name)} disabled={setProxy.isPending}>
              Salvar
            </Button>
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
