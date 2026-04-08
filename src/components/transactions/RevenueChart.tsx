import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Transaction } from '@/hooks/useTransactions';
import { useState, useMemo } from 'react';
import { format, eachDayOfInterval, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RevenueChartProps {
  transactions: Transaction[];
}

type PeriodOption = '3d' | '7d' | '15d' | '1m' | '6m';

const periodOptions: { value: PeriodOption; label: string }[] = [
  { value: '3d', label: '3D' },
  { value: '7d', label: '7D' },
  { value: '15d', label: '15D' },
  { value: '1m', label: '1M' },
  { value: '6m', label: '6M' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
    return (
      <div className="bg-card/95 backdrop-blur-md rounded-lg p-3 border border-border/50 shadow-xl">
        <p className="text-xs font-medium mb-2 text-muted-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name === 'boleto' ? 'Boleto' : entry.name === 'pix' ? 'PIX' : 'Cartão'}: R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        ))}
        <p className="text-xs font-semibold mt-2 pt-2 border-t border-border/50 text-foreground">
          Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

export function RevenueChart({ transactions }: RevenueChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('7d');

  const dateRange = useMemo(() => {
    const now = new Date();
    const end = endOfDay(now);
    let start: Date;

    switch (selectedPeriod) {
      case '3d': start = startOfDay(subDays(now, 2)); break;
      case '7d': start = startOfDay(subDays(now, 6)); break;
      case '15d': start = startOfDay(subDays(now, 14)); break;
      case '1m': start = startOfDay(subMonths(now, 1)); break;
      case '6m': start = startOfDay(subMonths(now, 6)); break;
      default: start = startOfDay(subDays(now, 6));
    }

    return { start, end };
  }, [selectedPeriod]);

  const chartData = useMemo(() => {
    const filteredTransactions = transactions.filter((t) => {
      const dateStr = t.paid_at || t.created_at;
      const date = new Date(dateStr);
      return date >= dateRange.start && date <= dateRange.end && t.status === 'aprovado';
    });

    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const dataMap: Record<string, { boleto: number; pix: number; cartao: number; label: string }> = {};
    
    days.forEach((date) => {
      const key = format(date, 'yyyy-MM-dd');
      dataMap[key] = { boleto: 0, pix: 0, cartao: 0, label: format(date, 'dd/MM', { locale: ptBR }) };
    });

    filteredTransactions.forEach((t) => {
      const dateStr = t.paid_at || t.created_at;
      const date = new Date(dateStr);
      const key = format(date, 'yyyy-MM-dd');
      const type = t.type as 'boleto' | 'pix' | 'cartao';
      if (dataMap[key] && dataMap[key][type] !== undefined) {
        dataMap[key][type] += Number(t.amount);
      }
    });

    return Object.values(dataMap);
  }, [transactions, dateRange]);

  const hasData = chartData.some((d) => d.boleto > 0 || d.pix > 0 || d.cartao > 0);

  const totalRevenue = useMemo(() => {
    return chartData.reduce((sum, d) => sum + d.boleto + d.pix + d.cartao, 0);
  }, [chartData]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const midpoint = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, midpoint).reduce((sum, d) => sum + d.boleto + d.pix + d.cartao, 0);
    const secondHalf = chartData.slice(midpoint).reduce((sum, d) => sum + d.boleto + d.pix + d.cartao, 0);
    if (firstHalf === 0) return null;
    const percentChange = ((secondHalf - firstHalf) / firstHalf) * 100;
    return { value: Math.abs(percentChange).toFixed(1), isPositive: percentChange >= 0 };
  }, [chartData]);

  return (
    <div className="bg-card/60 border border-border/30 rounded-xl p-5 animate-slide-up h-full" style={{ animationDelay: "300ms" }}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-baseline gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-foreground">Faturamento</h3>
            {trend && (
              <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{trend.value}%</span>
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">
            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        
        <div className="flex items-center gap-0.5 p-0.5 bg-secondary/30 rounded-lg border border-border/30">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedPeriod(option.value)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-semibold rounded transition-all duration-150",
                selectedPeriod === option.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-info" />
          <span className="text-muted-foreground">Boleto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-muted-foreground">PIX</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(280, 65%, 60%)" }} />
          <span className="text-muted-foreground">Cartão</span>
        </div>
      </div>
      
      <div className="h-[240px]">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Nenhuma transação no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBoleto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPix" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCartao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(280, 65%, 60%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(280, 65%, 60%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={9}
                tickLine={false}
                axisLine={false}
                interval={selectedPeriod === '6m' ? 'preserveStartEnd' : 0}
                angle={selectedPeriod === '6m' || selectedPeriod === '1m' ? -45 : 0}
                textAnchor={selectedPeriod === '6m' || selectedPeriod === '1m' ? "end" : "middle"}
                height={selectedPeriod === '6m' || selectedPeriod === '1m' ? 50 : 25}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={9}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="boleto" stroke="hsl(217, 91%, 60%)" fillOpacity={1} fill="url(#colorBoleto)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="pix" stroke="hsl(142, 70%, 45%)" fillOpacity={1} fill="url(#colorPix)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="cartao" stroke="hsl(280, 65%, 60%)" fillOpacity={1} fill="url(#colorCartao)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
