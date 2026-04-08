import { useState } from "react";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { FinancialReport } from "@/components/transactions/FinancialReport";
import { useTransactions } from "@/hooks/useTransactions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfDay, endOfDay } from "date-fns";
import { List, BarChart3 } from "lucide-react";

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
      <Tabs defaultValue="transacoes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="transacoes" className="flex items-center gap-1.5">
            <List className="h-4 w-4" />
            Transações
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Relatório
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transacoes">
          <TransactionsTable
            transactions={transactions}
            isLoading={isLoading}
            onDateFilterChange={handleDateFilterChange}
            dateStart={startDate}
            dateEnd={endDate}
          />
        </TabsContent>

        <TabsContent value="relatorio">
          <FinancialReport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Transacoes;
