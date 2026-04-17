import { useState, useEffect, useRef } from "react";
import { UsersRound, Users, Megaphone, Send, UserPlus, UserMinus, ShieldCheck, ShieldMinus, CalendarIcon, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/transactions/StatCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useGroupSelected } from "@/hooks/useGroupSelected";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import { useGroupQueue } from "@/hooks/useGroupQueue";
import { useGroupEvents, EventPeriod } from "@/hooks/useGroupEvents";
import { useWorkspace } from "@/hooks/useWorkspace";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import SchedulerDebugPanel from "./SchedulerDebugPanel";

const actionConfig: Record<string, { icon: typeof UserPlus; color: string; label: string }> = {
  add: { icon: UserPlus, color: "text-green-500 bg-green-500/10", label: "entrou em" },
  remove: { icon: UserMinus, color: "text-red-500 bg-red-500/10", label: "saiu de" },
  promote: { icon: ShieldCheck, color: "text-primary bg-primary/10", label: "promovido em" },
  demote: { icon: ShieldMinus, color: "text-orange-500 bg-orange-500/10", label: "rebaixado em" },
};

function getBrazilNow(): Date {
  const brazilDateStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brazilDateStr);
}

export default function GroupDashboardTab() {
  const { selectedGroups } = useGroupSelected();
  const { campaigns } = useGroupCampaigns();
  const { stats } = useGroupQueue();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { events, eventCounts, groupCounts, period, setPeriod, customRange, setCustomRange } = useGroupEvents();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();
  const [syncing, setSyncing] = useState(false);
  const syncedRef = useRef(false);

  const hasSelectedGroups = selectedGroups.length > 0;
  const totalMembers = selectedGroups.reduce((sum, g) => sum + g.member_count, 0);
  const activeCampaigns = campaigns.filter((c: any) => c.is_active).length;
  const groupsMonitored = selectedGroups.length;

  // Sync member counts from Evolution API
  const syncStats = async (silent = false) => {
    if (!workspaceId || syncing) return;
    setSyncing(true);
    try {
      const resp = await fetch(apiUrl("api/groups/sync-stats"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (resp.ok) {
        const result = await resp.json();
        queryClient.invalidateQueries({ queryKey: ["group-selected"] });
        if (!silent && result.synced > 0) {
          toast.success(`Sincronizado: ${result.synced} grupo(s) atualizado(s)`);
        }
      } else if (!silent) {
        toast.error("Falha ao sincronizar contagens");
      }
    } catch (e) {
      if (!silent) toast.error("Erro ao conectar com o servidor");
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync on mount (once)
  useEffect(() => {
    if (workspaceId && hasSelectedGroups && !syncedRef.current) {
      syncedRef.current = true;
      syncStats(true);
    }
  }, [workspaceId, hasSelectedGroups]);

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalendarRange(range);
    if (range?.from && range?.to) {
      setCustomRange({ from: range.from, to: range.to });
      setPeriod("custom");
      setCalendarOpen(false);
    }
  };

  const periodLabel = period === "today" ? "Hoje" : period === "yesterday" ? "Ontem" : 
    customRange ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}` : "Personalizado";

  return (
    <div className="min-w-0 w-full space-y-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncStats(false)}
          disabled={syncing || !hasSelectedGroups}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          Sincronizar
        </Button>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-secondary/30 rounded-lg border border-border/30">
          {(["today", "yesterday"] as EventPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150",
                period === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {p === "today" ? "Hoje" : "Ontem"}
            </button>
          ))}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150",
                  period === "custom"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {period === "custom" && customRange ? (
                  <span>{format(customRange.from, "dd/MM", { locale: ptBR })} - {format(customRange.to, "dd/MM", { locale: ptBR })}</span>
                ) : (
                  <span>Personalizado</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={calendarRange?.from}
                selected={calendarRange}
                onSelect={handleCalendarSelect}
                numberOfMonths={1}
                locale={ptBR}
                className="pointer-events-auto"
                disabled={{ after: getBrazilNow() }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Grupos Monitorados" value={String(groupsMonitored)} icon={UsersRound} iconColor="text-primary" />
        <StatCard title="Total de Membros" value={totalMembers.toLocaleString()} icon={Users} iconColor="text-primary" />
        <StatCard title="Campanhas Ativas" value={String(activeCampaigns)} icon={Megaphone} iconColor="text-primary" />
        <StatCard title="Enviadas Hoje" value={String(stats.sent)} icon={Send} iconColor="text-primary" />
        <StatCard title="Entraram" value={String(eventCounts.add)} icon={UserPlus} iconColor="text-green-500" />
        <StatCard title="Saíram" value={String(eventCounts.remove)} icon={UserMinus} iconColor="text-red-500" />
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
                {selectedGroups.map((g) => {
                  const ge = groupCounts[g.group_jid] || { add: 0, remove: 0, promote: 0, demote: 0 };
                  return (
                  <div key={g.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.group_name}</p>
                      <p className="text-xs text-muted-foreground">{g.instance_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ge.add > 0 && <span className="text-xs font-medium text-green-500">+{ge.add}</span>}
                      {ge.remove > 0 && <span className="text-xs font-medium text-red-500">-{ge.remove}</span>}
                      <Badge variant="outline" className="text-xs border-border/50">{g.member_count}</Badge>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 min-w-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eventos — {periodLabel}</p>
            </div>
            {events.length === 0 ? (
              <div className="px-6 py-8 text-center space-y-1.5">
                <p className="text-sm font-medium">
                  {hasSelectedGroups ? "Nenhum evento neste período." : "Selecione grupos para começar o monitoramento."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasSelectedGroups
                    ? "Depois, confirme na VPS se o webhook /api/groups/webhook/events está ativo para registrar entradas e saídas."
                    : "Depois que você salvar os grupos, esta lista começará a receber as movimentações monitoradas."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 max-h-[320px] overflow-y-auto">
                {events.slice(0, 50).map((e: any) => {
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
