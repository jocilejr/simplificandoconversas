import { useState, useMemo, useEffect } from "react";
import {
  UsersRound, Users, Megaphone, Send, UserPlus, UserMinus,
  CalendarIcon, Activity, Link2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/transactions/StatCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useGroupSmartLinks } from "@/hooks/useGroupSmartLinks";
import { useGroupCampaigns } from "@/hooks/useGroupCampaigns";
import { useGroupQueue } from "@/hooks/useGroupQueue";
import { useGroupEvents, EventPeriod } from "@/hooks/useGroupEvents";
import { useGroupEventsLive } from "@/hooks/useGroupEventsLive";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import SchedulerDebugPanel from "./SchedulerDebugPanel";

const STORAGE_KEY = "grupos:dashboard:smartLinkId";

function getBrazilNow(): Date {
  const brazilDateStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brazilDateStr);
}

function shortJid(jid: string): string {
  if (!jid) return "";
  return jid.split("@")[0];
}

export default function GroupDashboardTab() {
  const { smartLinks, isLoading: loadingLinks } = useGroupSmartLinks();
  const { campaigns } = useGroupCampaigns();
  const { stats } = useGroupQueue();
  const { totals: allTotals, groups: allGroupEvents, period, setPeriod, customRange, setCustomRange } = useGroupEvents();

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY) || "";
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();
  const [eventsOpen, setEventsOpen] = useState(false);
  const [, setTick] = useState(0);

  // Auto-seleciona o primeiro smart link se nenhum estiver salvo
  useEffect(() => {
    if (!selectedId && smartLinks.length > 0) {
      setSelectedId(smartLinks[0].id);
    }
  }, [smartLinks, selectedId]);

  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId);
  }, [selectedId]);

  const selectedLink = useMemo(
    () => smartLinks.find((sl) => sl.id === selectedId) || null,
    [smartLinks, selectedId]
  );

  const linkJids = useMemo(
    () => new Set((selectedLink?.group_links || []).map((g) => g.group_jid)),
    [selectedLink]
  );

  // Filtra eventos do período pelos JIDs do Smart Link selecionado
  const filteredGroupEvents = useMemo(
    () => allGroupEvents.filter((g) => linkJids.has(g.group_jid)),
    [allGroupEvents, linkJids]
  );

  const filteredTotals = useMemo(
    () => filteredGroupEvents.reduce(
      (acc, g) => ({ adds: acc.adds + g.adds, removes: acc.removes + g.removes }),
      { adds: 0, removes: 0 }
    ),
    [filteredGroupEvents]
  );

  const eventsByJid = useMemo(
    () => new Map(filteredGroupEvents.map((g) => [g.group_jid, g])),
    [filteredGroupEvents]
  );

  const { events: liveEventsAll, isLoading: liveLoading } = useGroupEventsLive(period, customRange, eventsOpen);
  const liveEvents = useMemo(
    () => liveEventsAll.filter((e) => linkJids.has(e.group_jid)),
    [liveEventsAll, linkJids]
  );

  // Re-renderiza a cada 30s para atualizar labels relativos
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const groupLinks = selectedLink?.group_links || [];
  // member_count vem do último sync e já reflete o estado real do grupo.
  // Não somar adds/removes do período (eles já são exibidos nos cards "Entraram"/"Saíram"
  // e dupliciariam a contagem se aplicados aqui).
  const totalMembers = groupLinks.reduce((sum, g) => sum + (g.member_count || 0), 0);
  const activeCampaigns = campaigns.filter((c: any) => c.is_active).length;
  const groupsCount = groupLinks.length;

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

  // Estado vazio: nenhum smart link criado
  if (!loadingLinks && smartLinks.length === 0) {
    return (
      <div className="space-y-4">
        <SchedulerDebugPanel />
        <Card className="border-border/50">
          <CardContent className="px-6 py-12 text-center space-y-2">
            <Link2 className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">Nenhum Smart Link criado.</p>
            <p className="text-sm text-muted-foreground">
              Crie um Smart Link na aba <span className="font-medium text-foreground">Smart Link</span> para começar a monitorar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-4 overflow-hidden">
      {/* 1) Programação do dia */}
      <div className="min-w-0 w-full overflow-hidden">
        <SchedulerDebugPanel />
      </div>

      {/* 2) Card de Informações Gerais */}
      <Card className="border-border/50 min-w-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-8 w-[260px] text-xs bg-secondary/30 border-border/40">
                  <SelectValue placeholder="Selecione um Smart Link" />
                </SelectTrigger>
                <SelectContent>
                  {smartLinks.map((sl) => (
                    <SelectItem key={sl.id} value={sl.id} className="text-xs">
                      <span className="font-medium">/{sl.slug}</span>
                      <span className="text-muted-foreground ml-2">
                        · {(sl.group_links || []).length} grupos
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground hidden md:inline">
                — {periodLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEventsOpen(true)}
                disabled={!selectedLink || groupsCount === 0}
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
            <StatCard title="Grupos do Smart Link" value={String(groupsCount)} icon={UsersRound} iconColor="text-primary" />
            <StatCard title="Total de Membros" value={totalMembers.toLocaleString()} icon={Users} iconColor="text-primary" />
            <StatCard title="Campanhas Ativas" value={String(activeCampaigns)} icon={Megaphone} iconColor="text-primary" />
            <StatCard title="Enviadas Hoje" value={String(stats.sent)} icon={Send} iconColor="text-primary" />
            <StatCard title="Entraram" value={String(filteredTotals.adds)} icon={UserPlus} iconColor="text-green-500" />
            <StatCard title="Saíram" value={String(filteredTotals.removes)} icon={UserMinus} iconColor="text-red-500" />
          </div>
        </CardContent>
      </Card>

      {/* 3) Card de Grupos do Smart Link */}
      <Card className="border-border/50 min-w-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Grupos do Smart Link {selectedLink ? `· /${selectedLink.slug}` : ""}
            </p>
            {selectedLink?.last_successful_sync_at && (
              <p className="text-[11px] text-muted-foreground">
                Sync {formatDistanceToNow(new Date(selectedLink.last_successful_sync_at), { locale: ptBR, addSuffix: true })}
              </p>
            )}
          </div>
          {groupsCount === 0 ? (
            <div className="px-6 py-8 text-center space-y-1.5">
              <p className="text-sm font-medium">Nenhum grupo neste Smart Link.</p>
              <p className="text-sm text-muted-foreground">
                Edite o Smart Link na aba <span className="font-medium text-foreground">Smart Link</span> para adicionar grupos.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 max-h-[420px] overflow-y-auto">
              {groupLinks.map((g) => {
                const ev = eventsByJid.get(g.group_jid);
                const status = g.last_sync_status;
                return (
                  <div key={g.group_jid} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.group_name || shortJid(g.group_jid)}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {status === "banned" && (
                          <span className="text-red-500 font-medium">banido</span>
                        )}
                        {status === "error" && (
                          <span className="text-amber-500 font-medium">erro</span>
                        )}
                        {g.last_synced_at && (
                          <span>
                            sync {formatDistanceToNow(new Date(g.last_synced_at), { locale: ptBR, addSuffix: true })}
                          </span>
                        )}
                      </div>
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
                <UserPlus className="h-3 w-3" />+{filteredTotals.adds} entraram
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="flex items-center gap-1 text-red-500 font-medium">
                <UserMinus className="h-3 w-3" />−{filteredTotals.removes} saíram
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
