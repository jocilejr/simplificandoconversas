import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    updateProfile.mutate({
      evolution_api_url: apiUrl,
      evolution_api_key: apiKey,
    });
  };

  const handleFetchInstances = async () => {
    const result = await fetchRemoteInstances.mutateAsync();
    if (Array.isArray(result)) {
      setRemoteInstances(result);
    } else if (result?.instances) {
      setRemoteInstances(result.instances);
    }
  };

  const handleCreateInstance = async () => {
    const result = await createInstance.mutateAsync();
    if (result?.qrcode?.base64) {
      setQrCode({ instanceName: result.instanceName, base64: result.qrcode.base64 });
    }
  };

  const handleConnect = async (instanceName: string) => {
    const result = await connectInstance.mutateAsync(instanceName);
    if (result?.base64) {
      setQrCode({ instanceName, base64: result.base64 });
    }
  };

  const handleSetProxy = (instanceName: string) => {
    const url = proxyInputs[instanceName];
    if (url) {
      setProxy.mutate({ instanceName, proxyUrl: url });
    }
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

  // Merge remote instances with local DB
  const mergedInstances = remoteInstances.length > 0
    ? remoteInstances.map((ri: any) => {
        const name = ri.instance?.instanceName || ri.instanceName || ri.name;
        const status = ri.instance?.state || ri.state || ri.status || "close";
        const local = instances.find(i => i.instance_name === name);
        return { name, status, is_active: local?.is_active || false, proxy_url: local?.proxy_url || null };
      })
    : instances.map(i => ({ name: i.instance_name, status: i.status, is_active: i.is_active, proxy_url: i.proxy_url }));

  return (
    <div className="space-y-6">
      {/* Credentials */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Servidor Evolution API</CardTitle>
          <CardDescription>Informe as credenciais globais do servidor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="flex gap-2">
            <Button onClick={handleSaveCredentials} disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Credenciais
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instance Management */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Instâncias WhatsApp</CardTitle>
              <CardDescription>Gerencie suas conexões WhatsApp</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchInstances}
                disabled={fetchRemoteInstances.isPending || !apiUrl || !apiKey}
              >
                {fetchRemoteInstances.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Atualizar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateInstance}
                disabled={createInstance.isPending || !apiUrl || !apiKey}
              >
                {createInstance.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Nova Instância
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mergedInstances.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <WifiOff className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma instância encontrada</p>
              <p className="text-xs mt-1">Salve as credenciais e clique em "Atualizar" ou crie uma nova</p>
            </div>
          )}

          {mergedInstances.map((inst) => (
            <div
              key={inst.name}
              className={`rounded-xl border p-4 transition-all ${
                inst.is_active ? "border-primary/40 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${
                    inst.status === "open" ? "bg-green-500" : inst.status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"
                  }`} />
                  <span className="font-medium text-sm">{inst.name}</span>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleConnect(inst.name)}
                      disabled={connectInstance.isPending}
                      className="text-xs"
                    >
                      <Wifi className="h-3.5 w-3.5 mr-1" />
                      Conectar
                    </Button>
                  )}
                  {!inst.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveInstance.mutate(inst.name)}
                      disabled={setActiveInstance.isPending}
                      className="text-xs"
                    >
                      <Star className="h-3.5 w-3.5 mr-1" />
                      Ativar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteInstance.mutate(inst.name)}
                    disabled={deleteInstance.isPending}
                    className="text-xs text-destructive hover:text-destructive"
                  >
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
                  value={proxyInputs[inst.name] ?? inst.proxy_url ?? ""}
                  onChange={(e) => setProxyInputs(prev => ({ ...prev, [inst.name]: e.target.value }))}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleSetProxy(inst.name)}
                  disabled={setProxy.isPending}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ))}

          {/* QR Code Modal */}
          {qrCode && (
            <div className="rounded-xl border border-primary/30 bg-card p-6 text-center">
              <p className="text-sm font-medium mb-3">
                Escaneie o QR Code para conectar <span className="text-primary">{qrCode.instanceName}</span>
              </p>
              <img
                src={qrCode.base64.startsWith("data:") ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
                alt="QR Code"
                className="mx-auto w-64 h-64 rounded-lg"
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => setQrCode(null)}
              >
                Fechar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
