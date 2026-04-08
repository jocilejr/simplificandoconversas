import { UsersRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GroupDashboardTab from "@/components/grupos/GroupDashboardTab";
import GroupSelectorTab from "@/components/grupos/GroupSelectorTab";
import GroupCampaignsTab from "@/components/grupos/GroupCampaignsTab";
import GroupQueueTab from "@/components/grupos/GroupQueueTab";

const GruposPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <UsersRound className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold">Grupos WhatsApp</h1>
    </div>

    <Tabs defaultValue="dashboard" className="w-full">
      <TabsList>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="grupos">Grupos</TabsTrigger>
        <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
        <TabsTrigger value="fila">Fila</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="mt-4">
        <GroupDashboardTab />
      </TabsContent>
      <TabsContent value="grupos" className="mt-4">
        <GroupSelectorTab />
      </TabsContent>
      <TabsContent value="campanhas" className="mt-4">
        <GroupCampaignsTab />
      </TabsContent>
      <TabsContent value="fila" className="mt-4">
        <GroupQueueTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default GruposPage;
