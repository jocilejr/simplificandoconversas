import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Transaction } from '@/hooks/useTransactions';
import { useMemo } from 'react';

interface PaymentMethodsChartProps {
  transactions: Transaction[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-md rounded-lg p-3 border border-border/50 shadow-xl">
        <p className="text-sm font-medium" style={{ color: payload[0].payload.color }}>
          {payload[0].name}: {payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

export function PaymentMethodsChart({ transactions }: PaymentMethodsChartProps) {
  const data = useMemo(() => {
    const total = transactions.length;
    if (total === 0) {
      return [
        { name: 'PIX', value: 33, color: 'hsl(142, 70%, 45%)', count: 0 },
        { name: 'Boleto', value: 33, color: 'hsl(217, 91%, 60%)', count: 0 },
        { name: 'Cartão', value: 34, color: 'hsl(280, 65%, 60%)', count: 0 },
      ];
    }

    const pixCount = transactions.filter((t) => t.type === 'pix').length;
    const boletoCount = transactions.filter((t) => t.type === 'boleto').length;
    const cartaoCount = transactions.filter((t) => t.type === 'cartao').length;

    return [
      { name: 'PIX', value: Math.round((pixCount / total) * 100), color: 'hsl(142, 70%, 45%)', count: pixCount },
      { name: 'Boleto', value: Math.round((boletoCount / total) * 100), color: 'hsl(217, 91%, 60%)', count: boletoCount },
      { name: 'Cartão', value: Math.round((cartaoCount / total) * 100), color: 'hsl(280, 65%, 60%)', count: cartaoCount },
    ].filter((d) => d.value > 0);
  }, [transactions]);

  const totalCount = transactions.length;

  return (
    <div className="bg-card/60 border border-border/30 rounded-xl p-5 animate-slide-up h-full" style={{ animationDelay: "350ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Distribuição</h3>
        <p className="text-xs text-muted-foreground">Por método de pagamento</p>
      </div>
      
      <div className="h-[180px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 mt-4">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{entry.count}</span>
              <span className="text-xs font-medium text-foreground w-8 text-right">{entry.value}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
