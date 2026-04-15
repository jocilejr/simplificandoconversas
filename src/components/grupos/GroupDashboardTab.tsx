import { UsersRound, Users, Megaphone, Send, UserPlus, UserMinus, ShieldCheck, ShieldMinus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/transactions/StatCard";
import { useGroupSelected } from "@/hooks/useGroupSelected";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import { useGroupQueue } from "@/hooks/useGroupQueue";
import { useGroupEvents } from "@/hooks/useGroupEvents";
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

  const hasSelectedGroups = selectedGroups.length > 0;
  const totalMembers = selectedGroups.reduce((sum, g) => sum + g.member_count, 0);
  const activeCampaigns = campaigns.filter((c: any) => c.is_active).length;
  const groupsMonitored = selectedGroups.length;

  const addCount = events.filter((e: any) => e.action === "add").length;
  const removeCount = events.filter((e: any) => e.action === "remove").length;

  const eventsByGroup = events.reduce<Record<string, { add: number; remove: number }>>((acc, e: any) => {
    const jid = e.group_jid;
    if (!acc[jid]) acc[jid] = { add: 0, remove: 0 };
    if (e.action === "add") acc[jid].add++;
    if (e.action === "remove") acc[jid].remove++;
    return acc;
  }, {});

  return (
    <div className="min-w-0 w-full space-y-4 overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Grupos Monitorados" value={String(groupsMonitored)} icon={UsersRound} iconColor="text-primary" />
        <StatCard title="Total de Membros" value={totalMembers.toLocaleString()} icon={Users} iconColor="text-primary" />
        <StatCard title="Campanhas Ativas" value={String(activeCampaigns)} icon={Megaphone} iconColor="text-primary" />
        <StatCard title="Enviadas Hoje" value={String(stats.sent)} icon={Send} iconColor="text-primary" />
        <StatCard title="Entraram" value={String(addCount)} icon={UserPlus} iconColor="text-green-500" />
        <StatCard title="Saíram" value={String(removeCount)} icon={UserMinus} iconColor="text-red-500" />
      </div>

      {!hasSelectedGroups && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-card">
          <CardContent className="space-y-1.5 p-4">
            <p className="text-sm font-semibold">Nenhum grupo monitorado ainda</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Abra a aba <span className="font-medium text-foreground">Selecionar</span> para buscar os grupos da sua instância e preencher esta visão geral.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="min-w-0 w-full overflow-hidden">
        <SchedulerDebugPanel />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/50 min-w-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Grupos Monitorados</p>
            </div>
            {!hasSelectedGroups ? (
              <div className="px-6 py-8 text-center space-y-1.5">
                <p className="text-sm font-medium">Nenhum grupo monitorado.</p>
                <p className="text-sm text-muted-foreground">
                  Use a aba Selecionar para adicionar grupos e preencher a contagem de membros.
                </p>
              </div>
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

        <Card className="border-border/50 min-w-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eventos Recentes</p>
            </div>
            {events.length === 0 ? (
              <div className="px-6 py-8 text-center space-y-1.5">
                <p className="text-sm font-medium">
                  {hasSelectedGroups ? "Nenhum evento recente ainda." : "Selecione grupos para começar o monitoramento."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasSelectedGroups
                    ? "Depois, confirme na VPS se o webhook /api/groups/webhook/events está ativo para registrar entradas e saídas."
                    : "Depois que você salvar os grupos, esta lista começará a receber as movimentações monitoradas."}
                </p>
              </div>
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
