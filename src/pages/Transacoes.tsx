import { useState } from "react";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { useTransactions } from "@/hooks/useTransactions";
import { startOfDay, endOfDay } from "date-fns";

function getBrazilNow(): Date {
  const brazilDateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(brazilDateStr);
}

const Transacoes = () => {
  const now = getBrazilNow();
  const [startDate, setStartDate] = useState<Date>(startOfDay(now));
  const [endDate, setEndDate] = useState<Date>(endOfDay(now));

  const { data: transactions = [], isLoading } = useTransactions(startDate, endDate);

  const handleDateFilterChange = (newStart: Date, newEnd: Date) => {
    setStartDate(newStart);
    setEndDate(newEnd);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <TransactionsTable
        transactions={transactions}
        isLoading={isLoading}
        onDateFilterChange={handleDateFilterChange}
        dateStart={startDate}
        dateEnd={endDate}
      />
    </div>
  );
};

export default Transacoes;
