import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailTemplatesTab } from "@/components/email/EmailTemplatesTab";
import { EmailCampaignsTab } from "@/components/email/EmailCampaignsTab";
import { EmailHistoryTab } from "@/components/email/EmailHistoryTab";
import { EmailContactsTab } from "@/components/email/EmailContactsTab";
import { EmailTagsTab } from "@/components/email/EmailTagsTab";
import { Card, CardContent } from "@/components/ui/card";
import { useEmailSends } from "@/hooks/useEmailSends";
import { Mail, MailCheck, MailX, Eye, TrendingUp, FileText, Megaphone, Clock, Users, Tag, MousePointerClick } from "lucide-react";

export default function EmailPage() {
  const [activeTab, setActiveTab] = useState("templates");
  const { stats, statsLoading } = useEmailSends({});

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E-mail Marketing</h1>
            <p className="text-sm text-muted-foreground">Gerencie templates, campanhas e acompanhe seus envios</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total</p>
                <p className="text-xl font-bold text-foreground">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MailCheck className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Enviados</p>
                <p className="text-xl font-bold text-foreground">{stats.sent}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <MailX className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Falhas</p>
                <p className="text-xl font-bold text-foreground">{stats.failed}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Eye className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Abertos</p>
                <p className="text-xl font-bold text-foreground">{stats.opened}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Taxa Abertura</p>
                <p className="text-xl font-bold text-foreground">{stats.openRate}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MousePointerClick className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Cliques</p>
                <p className="text-xl font-bold text-foreground">{stats.clicked || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Taxa Cliques</p>
                <p className="text-xl font-bold text-foreground">{stats.clickRate || "0"}%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="templates" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Megaphone className="h-3.5 w-3.5" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5" /> Contatos
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Tag className="h-3.5 w-3.5" /> Tags
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Clock className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <EmailCampaignsTab />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <EmailContactsTab />
        </TabsContent>
        <TabsContent value="tags" className="mt-4">
          <EmailTagsTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <EmailHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
