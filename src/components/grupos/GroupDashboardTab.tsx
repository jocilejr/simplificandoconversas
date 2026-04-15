import { UsersRound, Users, Megaphone, Send, UserPlus, UserMinus, ShieldCheck, ShieldMinus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/transactions/StatCard";
import { useGroupSelected } from "@/hooks/useGroupSelected";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import { useGroupQueue } from "@/hooks/useGroupQueue";
import { useGroupEvents } from "@/hooks/useGroupEvents";
import { useSchedulerDebug } from "@/hooks/useSchedulerDebug";
import { format } from "date-fns";
import SchedulerDebugPanel from "./SchedulerDebugPanel";

const actionConfig: Record<string, { icon: typeof UserPlus; color: string; label: string }> = {
  add: { icon: UserPlus, color: "text-green-500 bg-green-500/10", label: "entrou em" },
  remove: { icon: UserMinus, color: "text-red-500 bg-red-500/10", label: "saiu de" },
  promote: { icon: ShieldCheck, color: "text-primary bg-primary/10", label: "promovido em" },
  demote: { icon: ShieldMinus, color: "text-orange-500 bg-orange-500/10", label: "rebaixado em" },
};

export default function GroupDashboardTab() {
  const { selectedGroups } = useGroupSelected();
  const { campaigns } = useGroupCampaigns();
  const { stats } = useGroupQueue();
  const { events } = useGroupEvents();
  const { data: debugData } = useSchedulerDebug();

  const totalMembers = selectedGroups.reduce((sum, g) => sum + g.member_count, 0);
  const activeCampaigns = campaigns.filter((c: any) => c.is_active).length;
  const groupsMonitored = selectedGroups.length > 0 ? selectedGroups.length : (debugData?.groups_count || 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Grupos Monitorados" value={String(groupsMonitored)} icon={UsersRound} iconColor="text-primary" />
        <StatCard title="Total de Membros" value={totalMembers.toLocaleString()} icon={Users} iconColor="text-primary" />
        <StatCard title="Campanhas Ativas" value={String(activeCampaigns)} icon={Megaphone} iconColor="text-primary" />
        <StatCard title="Enviadas Hoje" value={String(stats.sent)} icon={Send} iconColor="text-primary" />
      </div>

      <SchedulerDebugPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Grupos Monitorados</p>
            </div>
            {selectedGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum grupo adicionado.</p>
            ) : (
              <div className="divide-y divide-border/30 max-h-[320px] overflow-y-auto">
                {selectedGroups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.group_name}</p>
                      <p className="text-xs text-muted-foreground">{g.instance_name}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs border-border/50">{g.member_count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eventos Recentes</p>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento registrado.</p>
            ) : (
              <div className="divide-y divide-border/30 max-h-[320px] overflow-y-auto">
                {events.slice(0, 20).map((e: any) => {
                  const cfg = actionConfig[e.action] || actionConfig.add;
                  const Icon = cfg.icon;
                  return (
                    <div key={e.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                      <div className={`p-1.5 rounded-md shrink-0 ${cfg.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">
                          <span className="font-medium">{e.participant_jid.split("@")[0]}</span>
                          {" "}{cfg.label}{" "}
                          <span className="text-muted-foreground">{e.group_name || e.group_jid}</span>
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(e.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
