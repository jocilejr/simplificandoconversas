import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Users,
  Bot,
  CalendarClock,
  AlertTriangle,
  Zap,
  CalendarIcon,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, isToday, isPast, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import type { DateRange } from "react-day-picker";

type PeriodType = "today" | "yesterday" | "custom";

const Dashboard = () => {
  const [period, setPeriod] = useState<PeriodType>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (period === "today") {
      return {
        startDate: startOfDay(now).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    }
    if (period === "yesterday") {
      const yesterday = subDays(now, 1);
      return {
        startDate: startOfDay(yesterday).toISOString(),
        endDate: endOfDay(yesterday).toISOString(),
      };
    }
    // custom
    if (customRange?.from) {
      return {
        startDate: startOfDay(customRange.from).toISOString(),
        endDate: endOfDay(customRange.to || customRange.from).toISOString(),
      };
    }
    return {
      startDate: startOfDay(now).toISOString(),
      endDate: endOfDay(now).toISOString(),
    };
  }, [period, customRange]);

  const { data, isLoading } = useDashboardStats(startDate, endDate);

  const periodLabel =
    period === "today"
      ? "Hoje"
      : period === "yesterday"
        ? "Ontem"
        : customRange?.from
          ? customRange.to && customRange.from !== customRange.to
            ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}`
            : format(customRange.from, "dd/MM/yyyy", { locale: ptBR })
          : "Personalizado";

  const stats = [
    {
      title: "Lembretes no Período",
      value: data?.remindersInPeriod.total ?? 0,
      icon: CalendarClock,
      detail: `${data?.remindersInPeriod.pending ?? 0} pendentes · ${data?.remindersInPeriod.completed ?? 0} concluídos`,
    },
    {
      title: "Lembretes Atrasados",
      value: data?.remindersOverdue ?? 0,
      icon: AlertTriangle,
      detail: "Vencidos antes do período",
      alert: (data?.remindersOverdue ?? 0) > 0,
    },
    {
      title: "Conversas no Período",
      value: data?.conversationsInPeriod ?? 0,
      icon: Users,
      detail: "Com mensagem no período",
    },
    {
      title: "Fluxos Ativos",
      value: data?.activeFlows ?? 0,
      icon: Bot,
      detail: "Ativos atualmente",
    },
    {
      title: "Execuções no Período",
      value: data?.executionsInPeriod ?? 0,
      icon: Zap,
      detail: "Fluxos executados",
    },
    {
      title: "Mensagens no Período",
      value: data?.messagesInPeriod.total ?? 0,
      icon: MessageSquare,
      detail: `${data?.messagesInPeriod.outbound ?? 0} enviadas · ${data?.messagesInPeriod.inbound ?? 0} recebidas`,
    },
  ];

  const getReminderBadge = (dueDate: string) => {
    const d = new Date(dueDate);
    if (isToday(d)) return <Badge className="bg-primary/20 text-primary border-0 text-[10px]">Hoje</Badge>;
    if (isPast(d)) return <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>;
    if (isFuture(d)) return <Badge variant="secondary" className="text-[10px]">Futuro</Badge>;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header + Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Visão geral — <span className="font-medium text-foreground">{periodLabel}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setPeriod("today")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                period === "today"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent text-muted-foreground"
              )}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriod("yesterday")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors border-x border-border",
                period === "yesterday"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent text-muted-foreground"
              )}
            >
              Ontem
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5",
                    period === "custom"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card hover:bg-accent text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Personalizado
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    if (range?.from) setPeriod("custom");
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) =>
          isLoading ? (
            <Card key={stat.title} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ) : (
            <Card key={stat.title} className={cn("bg-card border-border", stat.alert && "border-destructive/50")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={cn("h-4 w-4", stat.alert ? "text-destructive" : "text-primary")} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", stat.alert && "text-destructive")}>
                  {stat.value}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.detail}</p>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Bottom sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Reminders */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Lembretes Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : data?.recentReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum lembrete pendente
              </p>
            ) : (
              <div className="space-y-1">
                {data?.recentReminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-accent/50 transition-colors border-b border-border last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.contact_name || "Sem contato"} · {format(new Date(r.due_date), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {getReminderBadge(r.due_date)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Conversas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : data?.recentConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma conversa no período
              </p>
            ) : (
              <div className="space-y-1">
                {data?.recentConversations.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-accent/50 transition-colors border-b border-border last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {c.contact_name || c.phone_number || "Desconhecido"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                        {c.last_message || "Sem mensagem"}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                      {c.last_message_at
                        ? format(new Date(c.last_message_at), "dd/MM HH:mm", { locale: ptBR })
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
