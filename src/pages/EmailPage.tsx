import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailTemplatesTab } from "@/components/email/EmailTemplatesTab";
import { EmailCampaignsTab } from "@/components/email/EmailCampaignsTab";
import { EmailHistoryTab } from "@/components/email/EmailHistoryTab";
import { EmailWebhooksTab } from "@/components/email/EmailWebhooksTab";
import { Mail } from "lucide-react";

export default function EmailPage() {
  const [activeTab, setActiveTab] = useState("templates");

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">E-mail Marketing</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <EmailCampaignsTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <EmailHistoryTab />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          <EmailWebhooksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
