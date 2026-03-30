import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  Clock,
  TrendingUp,
  CalendarIcon,
  CreditCard,
  QrCode,
  Receipt,
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { ImportTransactions } from "@/components/transactions/ImportTransactions";
import type { DateRange } from "react-day-picker";

type PeriodType = "today" | "yesterday" | "custom";

const Transacoes = () => {
  const [period, setPeriod] = useState<PeriodType>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (period === "today") return { startDate: startOfDay(now), endDate: endOfDay(now) };
    if (period === "yesterday") {
      const y = subDays(now, 1);
      return { startDate: startOfDay(y), endDate: endOfDay(y) };
    }
    return {
      startDate: customRange?.from ? startOfDay(customRange.from) : startOfDay(now),
      endDate: customRange?.to ? endOfDay(customRange.to) : endOfDay(now),
    };
  }, [period, customRange]);

  const { data: transactions, isLoading, stats } = useTransactions({ startDate, endDate });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const periodLabel = period === "today"
    ? "Hoje"
    : period === "yesterday"
    ? "Ontem"
    : customRange?.from
    ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${customRange.to ? format(customRange.to, "dd/MM", { locale: ptBR }) : "..."}`
    : "Personalizado";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transações</h1>
          <p className="text-muted-foreground">Acompanhe seus recebimentos em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportTransactions />
          <div className="flex items-center rounded-lg border bg-card p-1 gap-1">
            {(["today", "yesterday"] as PeriodType[]).map(p => (
              <Button
                key={p}
                variant={period === p ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriod(p)}
                className="text-xs h-8"
              >
                {p === "today" ? "Hoje" : "Ontem"}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={period === "custom" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setPeriod("custom")}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {period === "custom" && customRange?.from
                    ? periodLabel
                    : "Período"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={r => {
                    setCustomRange(r);
                    setPeriod("custom");
                  }}
                  locale={ptBR}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalReceived)}</p>
                <p className="text-xs text-muted-foreground">{stats.countByStatus["pago"] || 0} pagamentos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pendente</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.totalPending)}</p>
                <p className="text-xs text-muted-foreground">{stats.countByStatus["pendente"] || 0} aguardando</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Transações</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">no período</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Por Tipo</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1"><QrCode className="h-3 w-3" /> PIX: {stats.countByType["pix"] || 0}</span>
                  <span className="flex items-center gap-1"><Receipt className="h-3 w-3" /> Boleto: {stats.countByType["boleto"] || 0}</span>
                  <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Cartão: {stats.countByType["cartao"] || 0}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <TransactionsTable transactions={transactions || []} />
      )}
    </div>
  );
};

export default Transacoes;
