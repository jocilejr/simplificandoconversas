import { useState, useMemo, useEffect } from "react";
import {
  UsersRound, Users, Megaphone, Send, UserPlus, UserMinus,
  CalendarIcon, Activity, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatCard } from "@/components/transactions/StatCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useGroupSelected } from "@/hooks/useGroupSelected";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import { useGroupQueue } from "@/hooks/useGroupQueue";
import { useGroupEvents, EventPeriod } from "@/hooks/useGroupEvents";
import { useGroupEventsLive } from "@/hooks/useGroupEventsLive";
import { useWorkspace } from "@/hooks/useWorkspace";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api";
import SchedulerDebugPanel from "./SchedulerDebugPanel";

function getBrazilNow(): Date {
  const brazilDateStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brazilDateStr);
}

function shortJid(jid: string): string {
  if (!jid) return "";
  return jid.split("@")[0];
}

export default function GroupDashboardTab() {
  const { selectedGroups, dataUpdatedAt } = useGroupSelected();
  const { campaigns } = useGroupCampaigns();
  const { stats } = useGroupQueue();
  const { workspaceId } = useWorkspace();
  const { totals, groups, period, setPeriod, customRange, setCustomRange } = useGroupEvents();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();
  const [eventsOpen, setEventsOpen] = useState(false);
  const [, setTick] = useState(0);

  const { events: liveEvents, isLoading: liveLoading } = useGroupEventsLive(period, customRange, eventsOpen);

  // Re-renderiza a cada 30s para atualizar o label "Atualizado há X"
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const hasSelectedGroups = selectedGroups.length > 0;
  const baseTotalMembers = selectedGroups.reduce((sum, g) => sum + g.member_count, 0);
  // Total dinâmico: base (re-baseado a cada 1h) + variação do período
  const totalMembers = baseTotalMembers + totals.adds - totals.removes;
  const activeCampaigns = campaigns.filter((c: any) => c.is_active).length;
  const groupsMonitored = selectedGroups.length;

  const eventsByJid = useMemo(
    () => new Map(groups.map((g) => [g.group_jid, g])),
    [groups]
  );

  const lastSyncLabel = dataUpdatedAt
    ? `Atualizado ${formatDistanceToNow(new Date(dataUpdatedAt), { locale: ptBR, addSuffix: true })}`
    : "Aguardando primeira atualização";
  const lastSyncTooltip = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalendarRange(range);
    if (range?.from && range?.to) {
      setCustomRange({ from: range.from, to: range.to });
      setPeriod("custom");
      setCalendarOpen(false);
    }
  };

  const periodLabel =
    period === "today"
      ? "Hoje"
      : period === "yesterday"
        ? "Ontem"
        : customRange
          ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}`
          : "Personalizado";

  return (
    <div className="min-w-0 w-full space-y-4 overflow-hidden">
      {/* 1) Programação do dia */}
      <div className="min-w-0 w-full overflow-hidden">
        <SchedulerDebugPanel />
      </div>

      {/* 2) Card de Informações Gerais (stats + filtro + ver eventos) */}
      <Card className="border-border/50 min-w-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Informações Gerais — {periodLabel}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs text-muted-foreground border border-border/40 rounded-md bg-secondary/20">
                      <Clock className="h-3.5 w-3.5" />
                      {lastSyncLabel}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{lastSyncTooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEventsOpen(true)}
                disabled={!hasSelectedGroups}
                className="gap-1.5 h-7 text-xs"
              >
                <Activity className="h-3.5 w-3.5" />
                Ver eventos em tempo real
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
                        <span>
                          {format(customRange.from, "dd/MM", { locale: ptBR })} - {format(customRange.to, "dd/MM", { locale: ptBR })}
                        </span>
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
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard title="Grupos Monitorados" value={String(groupsMonitored)} icon={UsersRound} iconColor="text-primary" />
            <StatCard title="Total de Membros" value={totalMembers.toLocaleString()} icon={Users} iconColor="text-primary" />
            <StatCard title="Campanhas Ativas" value={String(activeCampaigns)} icon={Megaphone} iconColor="text-primary" />
            <StatCard title="Enviadas Hoje" value={String(stats.sent)} icon={Send} iconColor="text-primary" />
            <StatCard title="Entraram" value={String(totals.adds)} icon={UserPlus} iconColor="text-green-500" />
            <StatCard title="Saíram" value={String(totals.removes)} icon={UserMinus} iconColor="text-red-500" />
          </div>
        </CardContent>
      </Card>

      {/* 3) Card de Grupos Monitorados (com adds/removes do período) */}
      <Card className="border-border/50 min-w-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Grupos Monitorados
            </p>
          </div>
          {!hasSelectedGroups ? (
            <div className="px-6 py-8 text-center space-y-1.5">
              <p className="text-sm font-medium">Nenhum grupo monitorado.</p>
              <p className="text-sm text-muted-foreground">
                Use a aba <span className="font-medium text-foreground">Selecionar</span> para escolher grupos.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 max-h-[420px] overflow-y-auto">
              {selectedGroups.map((g) => {
                const ev = eventsByJid.get(g.group_jid);
                return (
                  <div key={g.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.group_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{g.instance_name}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center gap-1 text-xs font-medium text-green-500">
                        <UserPlus className="h-3 w-3" />+{ev?.adds ?? 0}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                        <UserMinus className="h-3 w-3" />−{ev?.removes ?? 0}
                      </span>
                      <Badge variant="outline" className="text-xs border-border/50">{g.member_count}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de eventos em tempo real */}
      <Dialog open={eventsOpen} onOpenChange={setEventsOpen}>
        <DialogContent className="w-full max-w-lg min-w-0 overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Eventos em tempo real — {periodLabel}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-green-500 font-medium">
                <UserPlus className="h-3 w-3" />+{totals.adds} entraram
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="flex items-center gap-1 text-red-500 font-medium">
                <UserMinus className="h-3 w-3" />−{totals.removes} saíram
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">atualiza a cada 15s</span>
            </DialogDescription>
          </DialogHeader>
          {liveLoading && liveEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando eventos…</p>
          ) : liveEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum evento no período selecionado.
            </p>
          ) : (
            <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto -mx-6">
              {liveEvents.map((e) => {
                const isAdd = e.action === "add";
                const when = formatDistanceToNow(new Date(e.occurred_at), {
                  locale: ptBR,
                  addSuffix: true,
                });
                return (
                  <div key={e.id} className="flex items-start gap-3 px-6 py-2.5">
                    <div
                      className={cn(
                        "mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                        isAdd ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
                      )}
                    >
                      {isAdd ? <UserPlus className="h-3.5 w-3.5" /> : <UserMinus className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight">
                        <span className="font-medium">{shortJid(e.participant_jid)}</span>{" "}
                        <span className="text-muted-foreground">
                          {isAdd ? "entrou em" : "saiu de"}
                        </span>{" "}
                        <span className="font-medium">{e.group_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{when}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
