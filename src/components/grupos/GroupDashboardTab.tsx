import { UsersRound, Users, Megaphone, Send, UserPlus, UserMinus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGroupSelected } from "@/hooks/useGroupSelected";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import { useGroupQueue } from "@/hooks/useGroupQueue";
import { useGroupEvents } from "@/hooks/useGroupEvents";
import { format } from "date-fns";

export default function GroupDashboardTab() {
  const { selectedGroups } = useGroupSelected();
  const { campaigns } = useGroupCampaigns();
  const { stats } = useGroupQueue();
  const { events } = useGroupEvents();

  const totalMembers = selectedGroups.reduce((sum, g) => sum + g.member_count, 0);
  const activeCampaigns = campaigns.filter((c: any) => c.is_active).length;

  const cards = [
    { label: "Grupos Monitorados", value: selectedGroups.length, icon: UsersRound, color: "text-blue-500" },
    { label: "Total de Membros", value: totalMembers, icon: Users, color: "text-green-500" },
    { label: "Campanhas Ativas", value: activeCampaigns, icon: Megaphone, color: "text-purple-500" },
    { label: "Enviadas Hoje", value: stats.sent, icon: Send, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
                <c.icon className={`h-8 w-8 ${c.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Groups table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grupos Selecionados</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum grupo adicionado. Vá em "Grupos" para buscar e selecionar.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {selectedGroups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{g.group_name}</p>
                      <p className="text-xs text-muted-foreground">{g.instance_name}</p>
                    </div>
                    <Badge variant="secondary">{g.member_count} membros</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Eventos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento de participante registrado.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {events.slice(0, 20).map((e: any) => (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    {e.action === "add" ? (
                      <UserPlus className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <UserMinus className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">
                        <span className="font-medium">{e.participant_jid.split("@")[0]}</span>
                        {" "}{e.action === "add" ? "entrou em" : "saiu de"}{" "}
                        <span className="font-medium">{e.group_name || e.group_jid}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(e.created_at), "dd/MM HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
