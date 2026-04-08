import { useState, useMemo } from "react";
import { DateFilter, DateFilterValue, getDefaultDateFilter } from "./DateFilter";
import { FinancialStatCard } from "./FinancialStatCard";
import { RevenueChart } from "./RevenueChart";
import { PaymentMethodsChart } from "./PaymentMethodsChart";
import { useTransactions } from "@/hooks/useTransactions";
import { QrCode, FileText, CreditCard, DollarSign, Wallet } from "lucide-react";

export function FinancialReport() {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(getDefaultDateFilter);

  const { data: transactions = [], isLoading } = useTransactions(
    dateFilter.startDate,
    dateFilter.endDate
  );

  // All transactions for the chart (no date filter, fetched with wide range)
  const { data: allTransactions = [] } = useTransactions();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const calculateConversionRate = (paid: number, total: number) => {
    if (total === 0) return "0%";
    return `${((paid / total) * 100).toFixed(1)}% conversão`;
  };

  const stats = useMemo(() => {
    const pixGerado = transactions.filter((t) => t.type === "pix" && t.status !== "aprovado").length;
    const pixPago = transactions.filter((t) => t.type === "pix" && t.status === "aprovado").length;
    const boletosGerados = transactions.filter((t) => t.type === "boleto" && t.status === "pendente").length;
    const boletosPagos = transactions.filter((t) => t.type === "boleto" && t.status === "aprovado").length;
    const boletosPendentesOuPagos = transactions.filter(
      (t) => t.type === "boleto" && (t.status === "pendente" || t.status === "aprovado")
    ).length;
    const pedidosCartao = transactions.filter((t) => t.type === "cartao" && t.status !== "aprovado").length;
    const cartaoPago = transactions.filter((t) => t.type === "cartao" && t.status === "aprovado").length;

    const totalRevenue = transactions
      .filter((t) => t.status === "aprovado")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      pixGerado,
      pixPago,
      boletosGerados,
      boletosPagos,
      boletosPendentesOuPagos,
      pedidosCartao,
      cartaoPago,
      totalRevenue,
    };
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* Header with date filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Relatório Financeiro</h2>
          <p className="text-xs text-muted-foreground">Visão geral das suas transações</p>
        </div>
        <DateFilter value={dateFilter} onChange={setDateFilter} />
      </div>

      {/* Row 1: Generated */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        <FinancialStatCard title="PIX Gerado" value={stats.pixGerado.toLocaleString('pt-BR')} subtitle="No período" icon={QrCode} variant="info" delay={0} isLoading={isLoading} />
        <FinancialStatCard title="Boleto Gerado" value={stats.boletosGerados.toLocaleString('pt-BR')} subtitle="No período" icon={FileText} variant="info" delay={50} isLoading={isLoading} />
        <FinancialStatCard title="Cartão Gerado" value={stats.pedidosCartao.toLocaleString('pt-BR')} subtitle="No período" icon={CreditCard} variant="info" delay={100} isLoading={isLoading} />
      </div>

      {/* Row 2: Paid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        <FinancialStatCard title="PIX Pago" value={stats.pixPago.toLocaleString('pt-BR')} subtitle="No período" icon={QrCode} variant="success" delay={150} isLoading={isLoading} />
        <FinancialStatCard title="Boleto Pago" value={stats.boletosPagos.toLocaleString('pt-BR')} subtitle={calculateConversionRate(stats.boletosPagos, stats.boletosPendentesOuPagos)} icon={FileText} variant="success" delay={200} isLoading={isLoading} />
        <FinancialStatCard title="Cartão Pago" value={stats.cartaoPago.toLocaleString('pt-BR')} subtitle="No período" icon={CreditCard} variant="success" delay={250} isLoading={isLoading} />
      </div>

      {/* Row 3: Revenue */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
        <FinancialStatCard title="Faturamento" value={formatCurrency(stats.totalRevenue)} subtitle="Pedidos pagos" icon={DollarSign} variant="info" delay={300} isLoading={isLoading} />
        <FinancialStatCard title="Líquido" value={formatCurrency(stats.totalRevenue)} subtitle="Receita total" icon={Wallet} variant="success" delay={350} isLoading={isLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart transactions={allTransactions} />
        </div>
        <div>
          <PaymentMethodsChart transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
