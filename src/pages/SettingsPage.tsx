import { useProfile } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { ConnectionsSection } from "@/components/settings/ConnectionsSection";
import { AISection } from "@/components/settings/AISection";
import { AppSection } from "@/components/settings/AppSection";
import { IntegrationApiSection } from "@/components/settings/IntegrationApiSection";

const SettingsPage = () => {
  const { isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e conexões</p>
      </div>

      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="connections">Conexões</TabsTrigger>
          <TabsTrigger value="ai">IA</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="app">Aplicação</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>

        <TabsContent value="connections">
          <ConnectionsSection />
        </TabsContent>

        <TabsContent value="ai">
          <AISection />
        </TabsContent>

        <TabsContent value="api">
          <IntegrationApiSection />
        </TabsContent>

        <TabsContent value="app">
          <AppSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
