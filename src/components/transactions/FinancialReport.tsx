import { useState, useMemo } from "react";
import { DateFilter, DateFilterValue, getDefaultDateFilter } from "./DateFilter";
import { FinancialStatCard } from "./FinancialStatCard";
import { RevenueChart } from "./RevenueChart";
import { PaymentMethodsChart } from "./PaymentMethodsChart";
import { useTransactions } from "@/hooks/useTransactions";
import { useFinancialSettings } from "@/hooks/useFinancialSettings";
import { useMetaAdSpend } from "@/hooks/useMetaAdSpend";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCode, FileText, CreditCard, DollarSign, Wallet, Receipt } from "lucide-react";

export function FinancialReport() {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(getDefaultDateFilter);

  const { data: transactions = [], isLoading } = useTransactions(
    dateFilter.startDate,
    dateFilter.endDate
  );

  const { data: allTransactions = [] } = useTransactions();
  const { settings: feeSettings } = useFinancialSettings();
  const { data: metaAdSpend, isSyncing: isMetaSyncing } = useMetaAdSpend(dateFilter.startDate, dateFilter.endDate);
  const metaTotal = metaAdSpend?.totalSpend ?? 0;

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

    const approved = transactions.filter((t) => t.status === "aprovado");
    const totalRevenue = approved.reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate fees
    let totalFees = 0;
    let totalTax = 0;
    let boletoFees = 0;
    let pixFees = 0;
    let cartaoFees = 0;
    if (feeSettings) {
      for (const t of approved) {
        const amount = Number(t.amount);
        let feeType: "fixed" | "percent" = "fixed";
        let feeValue = 0;

        if (t.type === "boleto") { feeType = feeSettings.boleto_fee_type; feeValue = feeSettings.boleto_fee_value; }
        else if (t.type === "pix") { feeType = feeSettings.pix_fee_type; feeValue = feeSettings.pix_fee_value; }
        else if (t.type === "cartao") { feeType = feeSettings.cartao_fee_type; feeValue = feeSettings.cartao_fee_value; }

        const fee = feeType === "percent" ? amount * (feeValue / 100) : feeValue;
        totalFees += fee;
        if (t.type === "boleto") boletoFees += fee;
        else if (t.type === "pix") pixFees += fee;
        else if (t.type === "cartao") cartaoFees += fee;

        totalTax += feeSettings.tax_type === "percent" ? amount * (feeSettings.tax_value / 100) : feeSettings.tax_value;
      }
    }

    return {
      pixGerado, pixPago, boletosGerados, boletosPagos, boletosPendentesOuPagos,
      pedidosCartao, cartaoPago, totalRevenue,
      netRevenue: totalRevenue - totalFees - totalTax - metaTotal,
      boletoFees, pixFees, cartaoFees, totalTax,
    };
  }, [transactions, feeSettings, metaTotal]);

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

      {/* Row 3: Revenue + Deductions */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        <FinancialStatCard title="Faturamento" value={formatCurrency(stats.totalRevenue)} subtitle="Pedidos pagos" icon={DollarSign} variant="info" delay={300} isLoading={isLoading} />
        
        {/* Compact deductions card */}
        <div className="bg-card/60 border border-border/30 rounded-xl p-4 lg:p-5 animate-slide-up" style={{ animationDelay: '325ms' }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-[11px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wide">Deduções</p>
            <div className="p-2 lg:p-2.5 rounded-lg shrink-0 bg-destructive/10 text-destructive">
              <Receipt className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </div>
          {feeSettings ? (
            <div className="space-y-1">
              {[
                { label: "Boleto", value: stats.boletoFees },
                { label: "PIX", value: stats.pixFees },
                { label: "Cartão", value: stats.cartaoFees },
                { label: feeSettings.tax_name, value: stats.totalTax },
                { label: "Meta Ads", value: metaTotal },
              ].filter(i => i.value > 0).map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[10px] lg:text-[11px] text-muted-foreground">{item.label}</span>
                  <span className="text-[10px] lg:text-[11px] font-medium text-destructive">- {formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Sem taxas configuradas</p>
          )}
        </div>

        <FinancialStatCard title="Líquido" value={formatCurrency(stats.netRevenue)} subtitle="Após taxas e impostos" icon={Wallet} variant="success" delay={350} isLoading={isLoading} />
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
