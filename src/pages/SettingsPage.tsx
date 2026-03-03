import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SettingsPage = () => {
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
            <Input placeholder="https://sua-instancia.evolution-api.com" />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" placeholder="Sua API Key" />
          </div>
          <div className="space-y-2">
            <Label>Nome da Instância</Label>
            <Input placeholder="minha-instancia" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Testar Conexão</Button>
            <Button>Salvar</Button>
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
            <Input placeholder="Seu nome" />
          </div>
          <Button>Salvar Perfil</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
