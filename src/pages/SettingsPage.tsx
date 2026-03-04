import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const SettingsPage = () => {
  const { profile, isLoading, updateProfile, testConnection } = useProfile();

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [fullName, setFullName] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");

  useEffect(() => {
    if (profile) {
      setApiUrl(profile.evolution_api_url || "");
      setApiKey(profile.evolution_api_key || "");
      setInstanceName(profile.evolution_instance_name || "");
      setFullName(profile.full_name || "");
      setOpenaiKey(profile.openai_api_key || "");
    }
  }, [profile]);

  const handleSaveApi = () => {
    updateProfile.mutate({
      evolution_api_url: apiUrl,
      evolution_api_key: apiKey,
      evolution_instance_name: instanceName,
    });
  };

  const handleSaveProfile = () => {
    updateProfile.mutate({ full_name: fullName });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Configure sua instância da Evolution API</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Evolution API</CardTitle>
          <CardDescription>Insira os dados da sua instância</CardDescription>
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
            <Label>API Key</Label>
            <Input
              type="password"
              placeholder="Sua API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nome da Instância</Label>
            <Input
              placeholder="minha-instancia"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending || !apiUrl || !apiKey || !instanceName}
            >
              {testConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : testConnection.isSuccess ? (
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              ) : testConnection.isError ? (
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
              ) : null}
              Testar Conexão
            </Button>
            <Button onClick={handleSaveApi} disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Perfil</CardTitle>
          <CardDescription>Gerencie seus dados de perfil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Perfil
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Webhook</CardTitle>
          <CardDescription>
            Configure este URL no painel da Evolution API para receber mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <Input
              readOnly
              value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`}
              onClick={(e) => {
                (e.target as HTMLInputElement).select();
                navigator.clipboard.writeText(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              Clique para copiar. Configure o evento <strong>MESSAGES_UPSERT</strong> na Evolution API.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
