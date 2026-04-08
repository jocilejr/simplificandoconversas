import { UsersRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GroupDashboardTab from "@/components/grupos/GroupDashboardTab";
import GroupSelectorTab from "@/components/grupos/GroupSelectorTab";
import GroupCampaignsTab from "@/components/grupos/GroupCampaignsTab";
import GroupQueueTab from "@/components/grupos/GroupQueueTab";

const GruposPage = () => (
  <div className="space-y-6">
    <div>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <UsersRound className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Grupos</h1>
          <p className="text-xs text-muted-foreground">Gerencie campanhas e monitore seus grupos</p>
        </div>
      </div>
    </div>

    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="bg-muted/50">
        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        <TabsTrigger value="selection">Seleção</TabsTrigger>
        <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        <TabsTrigger value="queue">Fila</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <GroupDashboardTab />
      </TabsContent>
      <TabsContent value="selection" className="mt-4">
        <GroupSelectorTab />
      </TabsContent>
      <TabsContent value="campaigns" className="mt-4">
        <GroupCampaignsTab />
      </TabsContent>
      <TabsContent value="queue" className="mt-4">
        <GroupQueueTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default GruposPage;
