import { useState } from "react";
import { Receipt, CheckCircle, Clock, XCircle, DollarSign } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { StatCard } from "@/components/transactions/StatCard";
import { DateFilter } from "@/components/transactions/DateFilter";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const Transacoes = () => {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const { data: transactions = [], isLoading, stats } = useTransactions(startDate, endDate);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Transações</h1>
        </div>
        <DateFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Total"
          value={formatCurrency(stats.totalAmount)}
          subtitle={`${stats.total} transações`}
          icon={DollarSign}
        />
        <StatCard
          title="Aprovados"
          value={formatCurrency(stats.approvedAmount)}
          subtitle={`${stats.approvedCount} transações`}
          icon={CheckCircle}
          iconColor="text-green-500"
        />
        <StatCard
          title="Pendentes"
          value={formatCurrency(stats.pendingAmount)}
          subtitle={`${stats.pendingCount} transações`}
          icon={Clock}
          iconColor="text-yellow-500"
        />
        <StatCard
          title="Rejeitados"
          value={formatCurrency(stats.rejectedAmount)}
          subtitle={`${stats.rejectedCount} transações`}
          icon={XCircle}
          iconColor="text-red-500"
        />
      </div>

      <TransactionsTable transactions={transactions} isLoading={isLoading} />
    </div>
  );
};

export default Transacoes;
