import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, MessageSquare, Bot, Clock, CalendarIcon, Send, Download, Zap, Percent, Receipt } from "lucide-react";
import { format, formatDistanceToNow, isToday, isPast, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDashboardStats, type PeriodFilter } from "@/hooks/useDashboardStats";
import { useProfile } from "@/hooks/useProfile";
import { useFinancialSettings } from "@/hooks/useFinancialSettings";
import { cn } from "@/lib/utils";

const periodLabels: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7days", label: "7 dias" },
  { value: "30days", label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

const Dashboard = () => {
  const [period, setPeriod] = useState<PeriodFilter>("7days");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>();
  const [tempTo, setTempTo] = useState<Date | undefined>();

  const { profile } = useProfile();
  const { settings: feeSettings, isLoading: feesLoading } = useFinancialSettings();
  const stats = useDashboardStats(period, customRange);

  const firstName = profile?.full_name?.split(" ")[0] || "";

  const handleCustomSelect = () => {
    if (tempFrom && tempTo) {
      setCustomRange({ from: tempFrom, to: tempTo });
      setPeriod("custom");
      setDatePickerOpen(false);
    }
  };

  const getReminderBadge = (dueDate: string) => {
    const d = new Date(dueDate);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    if (isBefore(d, todayStart)) {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>;
    }
    if (isToday(d)) {
      return <Badge variant="outline" className="bg-accent text-accent-foreground text-[10px] px-1.5 py-0">Hoje</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Futuro</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {firstName ? `Olá, ${firstName}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm">Visão geral do seu sistema</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {periodLabels.map((p) =>
            p.value === "custom" ? (
              <Popover key={p.value} open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={period === "custom" ? "default" : "outline"}
                    className="text-xs gap-1"
                  >
                    <CalendarIcon className="h-3 w-3" />
                    {period === "custom" && customRange
                      ? `${format(customRange.from, "dd/MM")} - ${format(customRange.to, "dd/MM")}`
                      : p.label}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="end">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">De</p>
                        <Calendar
                          mode="single"
                          selected={tempFrom}
                          onSelect={setTempFrom}
                          className="p-0 pointer-events-auto"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Até</p>
                        <Calendar
                          mode="single"
                          selected={tempTo}
                          onSelect={setTempTo}
                          className="p-0 pointer-events-auto"
                        />
                      </div>
                    </div>
                    <Button size="sm" className="w-full" onClick={handleCustomSelect} disabled={!tempFrom || !tempTo}>
                      Aplicar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                key={p.value}
                size="sm"
                variant={period === p.value ? "default" : "outline"}
                className="text-xs"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-xl">
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="rounded-xl border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lembretes Atrasados</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.overdueReminders}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats.todayReminders} para hoje</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Conversas</CardTitle>
                <MessageSquare className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.conversationsInPeriod}</div>
                <p className="text-xs text-muted-foreground mt-1">no período selecionado</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fluxos Ativos</CardTitle>
                <Bot className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeFlows}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats.executionsInPeriod} execuções no período</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mensagens</CardTitle>
                <Send className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.messages.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.messages.sent} enviadas · {stats.messages.received} recebidas
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Fees & Taxes Card */}
      <Card className="rounded-xl border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Taxas e Impostos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : !feeSettings ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma taxa configurada. Acesse Configurações → Taxas para definir.
            </p>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Boleto", type: feeSettings.boleto_fee_type, value: feeSettings.boleto_fee_value },
                { label: "PIX", type: feeSettings.pix_fee_type, value: feeSettings.pix_fee_value },
                { label: "Cartão", type: feeSettings.cartao_fee_type, value: feeSettings.cartao_fee_value },
              ].map((fee) => (
                <div key={fee.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-sm font-medium">{fee.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {fee.type === "percent"
                      ? `${fee.value}%`
                      : `R$ ${fee.value.toFixed(2)}`}
                  </Badge>
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5 border-t border-border">
                <span className="text-sm font-medium">{feeSettings.tax_name}</span>
                <Badge variant="outline" className="text-xs">
                  {feeSettings.tax_type === "percent"
                    ? `${feeSettings.tax_value}%`
                    : `R$ ${feeSettings.tax_value.toFixed(2)}`}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Reminders */}
        <Card className="rounded-xl border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Próximos Lembretes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats.upcomingReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum lembrete pendente</p>
            ) : (
              <div className="space-y-3">
                {stats.upcomingReminders.map((r: any) => (
                  <div key={r.id} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{r.title}</span>
                        {getReminderBadge(r.due_date)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.contact_name || r.phone_number || r.remote_jid?.replace("@s.whatsapp.net", "")}
                        {" · "}
                        {format(new Date(r.due_date), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card className="rounded-xl border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Conversas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats.recentConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conversa recente</p>
            ) : (
              <div className="space-y-3">
                {stats.recentConversations.map((c: any) => (
                  <div key={c.id} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">
                        {c.contact_name || c.phone_number || c.remote_jid?.replace("@s.whatsapp.net", "")}
                      </span>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.last_message || "Sem mensagem"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                      {c.last_message_at
                        ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: ptBR })
                        : ""}
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
