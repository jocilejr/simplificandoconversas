import { LayoutDashboard, CheckSquare, Megaphone, ListOrdered, Link2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GroupDashboardTab from "@/components/grupos/GroupDashboardTab";
import GroupSelectorTab from "@/components/grupos/GroupSelectorTab";
import GroupCampaignsTab from "@/components/grupos/GroupCampaignsTab";
import GroupQueueTab from "@/components/grupos/GroupQueueTab";
import GroupSmartLinkTab from "@/components/grupos/GroupSmartLinkTab";

const GruposPage = () => (
  <div className="space-y-4">
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="h-10 bg-card border border-border/50 p-0.5 gap-0.5">
        <TabsTrigger value="overview" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
          <LayoutDashboard className="h-3.5 w-3.5" />
          Visão Geral
        </TabsTrigger>
        <TabsTrigger value="selector" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
          <CheckSquare className="h-3.5 w-3.5" />
          Selecionar
        </TabsTrigger>
        <TabsTrigger value="campaigns" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
          <Megaphone className="h-3.5 w-3.5" />
          Campanhas
        </TabsTrigger>
        <TabsTrigger value="queue" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
          <ListOrdered className="h-3.5 w-3.5" />
          Fila
        </TabsTrigger>
        <TabsTrigger value="smart-link" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
          <Link2 className="h-3.5 w-3.5" />
          Smart Link
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <GroupDashboardTab />
      </TabsContent>
      <TabsContent value="selector" className="mt-4">
        <GroupSelectorTab />
      </TabsContent>
      <TabsContent value="campaigns" className="mt-4">
        <GroupCampaignsTab />
      </TabsContent>
      <TabsContent value="queue" className="mt-4">
        <GroupQueueTab />
      </TabsContent>
      <TabsContent value="smart-link" className="mt-4">
        <GroupSmartLinkTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default GruposPage;
