import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Trash2, Download, Search, ChevronDown, ChevronUp,
  Users, Clock, CheckCircle2, AlertCircle, RefreshCw,
  CalendarIcon, Copy, ExternalLink, MessageSquare, Save, Info,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@/hooks/useTransactions";
import { TransactionDetailDialog } from "./TransactionDetailDialog";
import { RecoveryPopover } from "./RecoveryPopover";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { useRecoveryClicks } from "@/hooks/useRecoveryClicks";
import { useProfile } from "@/hooks/useProfile";

interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onDateFilterChange?: (startDate: Date, endDate: Date) => void;
  dateStart?: Date;
  dateEnd?: Date;
}

type TabKey = "aprovados" | "boletos-gerados" | "pix-cartao-pendentes" | "mensagens";
type SortField = "created_at" | "amount" | "customer_name";
type SortDirection = "asc" | "desc";
type DatePreset = "today" | "yesterday" | "7days" | "30days" | "custom";

const typeLabels: Record<string, string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
  card: "Cartão",
};

const statusStyles: Record<string, string> = {
  aprovado: "bg-green-500/20 text-green-600 border-green-500/30",
  pendente: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  rejeitado: "bg-destructive/20 text-destructive border-destructive/30",
  cancelado: "bg-destructive/20 text-destructive border-destructive/30",
  processando: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  reembolsado: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  estornado: "bg-purple-500/20 text-purple-600 border-purple-500/30",
};

const statusLabels: Record<string, string> = {
  aprovado: "Pago",
  pendente: "Pendente",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
  processando: "Processando",
  reembolsado: "Reembolsado",
  estornado: "Estornado",
};

const typeStyles: Record<string, string> = {
  boleto: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  pix: "bg-green-500/20 text-green-600 border-green-500/30",
  cartao: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  card: "bg-purple-500/20 text-purple-600 border-purple-500/30",
};

const DEFAULT_EMAIL = "businessvivaorigem@gmail.com";
const isRealEmail = (email: string | null) => email && email.toLowerCase() !== DEFAULT_EMAIL.toLowerCase();

function getBrazilNow(): Date {
  const brazilDateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(brazilDateStr);
}

export function TransactionsTable({ transactions, isLoading, onDateFilterChange, dateStart, dateEnd }: TransactionsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("aprovados");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(15);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const queryClient = useQueryClient();

  // Recovery hooks
  const { profile, updateProfile } = useProfile();
  const { sendText, isConnected: isExtensionConnected } = useWhatsAppExtension();

  // Get pending transaction IDs for recovery clicks
  const pendingTxIds = useMemo(() =>
    transactions.filter((t) => t.status === "pendente").map((t) => t.id),
    [transactions]
  );
  const { addClick, getClickCount } = useRecoveryClicks(pendingTxIds);

  // Recovery message state
  const [boletoMsg, setBoletoMsg] = useState("");
  const [pixMsg, setPixMsg] = useState("");
  const [savingMsgs, setSavingMsgs] = useState(false);

  const DEFAULT_BOLETO_MSG = `{saudação}, {primeiro_nome}! 😊\n\nVi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?\n\nCaso já tenha pago, pode desconsiderar essa mensagem! 🙏`;
  const DEFAULT_PIX_MSG = `{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏`;

  useEffect(() => {
    if (profile) {
      setBoletoMsg((profile as any)?.recovery_message_boleto || DEFAULT_BOLETO_MSG);
      setPixMsg((profile as any)?.recovery_message_pix || DEFAULT_PIX_MSG);
    }
  }, [profile]);

  

  const handleSaveMessages = async () => {
    setSavingMsgs(true);
    try {
      await updateProfile.mutateAsync({
        recovery_message_boleto: boletoMsg,
        recovery_message_pix: pixMsg,
      });
      toast.success("Mensagens salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar mensagens");
    } finally {
      setSavingMsgs(false);
    }
  };

  const getRecoveryMessage = (tab: TabKey) => {
    if (tab === "boletos-gerados") {
      return boletoMsg || DEFAULT_BOLETO_MSG;
    }
    return pixMsg || DEFAULT_PIX_MSG;
  };

  // Reset visible count when tab changes

  // Reset visible count when tab changes
  useEffect(() => {
    setVisibleCount(15);
  }, [activeTab]);

  const handleDatePreset = (type: DatePreset) => {
    const now = getBrazilNow();
    let start: Date;
    let end = endOfDay(now);

    switch (type) {
      case "today":
        start = startOfDay(now);
        break;
      case "yesterday":
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case "7days":
        start = startOfDay(subDays(now, 6));
        break;
      case "30days":
        start = startOfDay(subDays(now, 29));
        break;
      default:
        start = startOfDay(now);
    }

    setDatePreset(type);
    onDateFilterChange?.(start, end);
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      setDatePreset("custom");
      onDateFilterChange?.(startOfDay(range.from), endOfDay(range.to));
      setIsCalendarOpen(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString("pt-BR");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR") + " " + date.toLocaleDateString("pt-BR");
  };

  // Tab filtering
  const tabTransactions = useMemo(() => ({
    aprovados: transactions.filter((t) => t.status === "aprovado"),
    "boletos-gerados": transactions.filter((t) => t.type === "boleto" && t.status === "pendente"),
    "pix-cartao-pendentes": transactions.filter(
      (t) => (t.type === "pix" || t.type === "cartao" || t.type === "card") && t.status === "pendente"
    ),
  }), [transactions]);

  // Tab stats
  const tabStats = useMemo(() => {
    const current = tabTransactions[activeTab] || [];
    const totalAmount = current.reduce((sum, t) => sum + Number(t.amount), 0);
    const uniqueCustomers = new Set(current.filter((t) => t.customer_name).map((t) => t.customer_name)).size;
    return { totalAmount, uniqueCustomers, total: current.length };
  }, [tabTransactions, activeTab]);

  // Search + sort
  const filteredTransactions = useMemo(() => {
    let result = tabTransactions[activeTab] || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t) =>
        t.customer_name?.toLowerCase().includes(q) ||
        t.customer_phone?.includes(q) ||
        t.customer_email?.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "amount":
          aVal = Number(a.amount);
          bVal = Number(b.amount);
          break;
        case "customer_name":
          aVal = a.customer_name || "";
          bVal = b.customer_name || "";
          break;
        default:
          aVal = new Date(a.paid_at || a.created_at).getTime();
          bVal = new Date(b.paid_at || b.created_at).getTime();
      }
      return sortDirection === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return result;
  }, [tabTransactions, activeTab, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Transação removida");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch {
      toast.error("Erro ao remover transação");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 ml-1 inline" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 ml-1 inline" />
    );
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border/30 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/30 rounded-xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold">Transações Recentes</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["transactions"] });
              toast.success("Transações atualizadas");
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
          Mostrando {Math.min(visibleCount, filteredTransactions.length)} de {filteredTransactions.length}
        </span>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {[
          { type: "today" as DatePreset, label: "Hoje" },
          { type: "yesterday" as DatePreset, label: "Ontem" },
          { type: "7days" as DatePreset, label: "7 dias" },
          { type: "30days" as DatePreset, label: "30 dias" },
        ].map((p) => (
          <Button
            key={p.type}
            variant={datePreset === p.type ? "default" : "outline"}
            size="sm"
            onClick={() => handleDatePreset(p.type)}
            className="h-8 shrink-0 text-xs"
          >
            {p.label}
          </Button>
        ))}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={datePreset === "custom" ? "default" : "outline"}
              size="sm"
              className={cn("h-8 gap-2 shrink-0 text-xs", datePreset === "custom" && "min-w-[140px]")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {datePreset === "custom" && dateStart && dateEnd ? (
                <span>
                  {format(dateStart, "dd/MM/yy", { locale: ptBR })} - {format(dateEnd, "dd/MM/yy", { locale: ptBR })}
                </span>
              ) : (
                <span>Personalizado</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={customRange?.from || getBrazilNow()}
              selected={customRange}
              onSelect={handleCustomRangeSelect}
              numberOfMonths={1}
              locale={ptBR}
              className="pointer-events-auto"
              toDate={getBrazilNow()}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="mb-4">
        <TabsList className="grid grid-cols-4 gap-1 h-auto p-1">
          <TabsTrigger value="aprovados" className="text-[10px] sm:text-xs py-2 px-1.5 sm:px-3">
            Aprovados ({tabTransactions.aprovados.length})
          </TabsTrigger>
          <TabsTrigger value="boletos-gerados" className="text-[10px] sm:text-xs py-2 px-1.5 sm:px-3">
            Boletos Ger. ({tabTransactions["boletos-gerados"].length})
          </TabsTrigger>
          <TabsTrigger value="pix-cartao-pendentes" className="text-[10px] sm:text-xs py-2 px-1.5 sm:px-3">
            PIX/Cartão Pend. ({tabTransactions["pix-cartao-pendentes"].length})
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="text-[10px] sm:text-xs py-2 px-1.5 sm:px-3 gap-1">
            <MessageSquare className="h-3 w-3" />
            Mensagens
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Messages Config Tab */}
      {activeTab === "mensagens" ? (
        <div className="space-y-5">
          {/* Variables Reference */}
          <div className="bg-secondary/20 border border-border/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Variáveis disponíveis</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "{saudação}", desc: "Bom dia / Boa tarde / Boa noite" },
                { key: "{nome}", desc: "Nome completo do cliente" },
                { key: "{primeiro_nome}", desc: "Primeiro nome do cliente" },
                { key: "{valor}", desc: "Valor da transação (R$)" },
              ].map((v) => (
                <div key={v.key} className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {v.key}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{v.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Boleto Message */}
          <div className="bg-secondary/10 border border-border/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold">Mensagem para Boletos</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Enviada ao recuperar transações de boletos não pagos
            </p>
            <Textarea
              value={boletoMsg}
              onChange={(e) => setBoletoMsg(e.target.value)}
              rows={5}
              className="font-mono text-sm"
              placeholder="Digite a mensagem de recuperação para boletos..."
            />
          </div>

          {/* PIX/Card Message */}
          <div className="bg-secondary/10 border border-border/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <h3 className="text-sm font-semibold">Mensagem para PIX / Cartão</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Enviada ao recuperar transações pendentes de PIX ou Cartão
            </p>
            <Textarea
              value={pixMsg}
              onChange={(e) => setPixMsg(e.target.value)}
              rows={5}
              className="font-mono text-sm"
              placeholder="Digite a mensagem de recuperação para PIX/Cartão..."
            />
          </div>

          <Button onClick={handleSaveMessages} disabled={savingMsgs} className="gap-2">
            <Save className="h-4 w-4" />
            {savingMsgs ? "Salvando..." : "Salvar Mensagens"}
          </Button>
        </div>
      ) : (
      <>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-3 gap-3 mb-5 p-4 bg-secondary/20 rounded-lg border border-border/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-sm font-semibold">{tabStats.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <AlertCircle className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor Total</p>
            <p className="text-sm font-semibold">{formatCurrency(tabStats.totalAmount)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clientes</p>
            <p className="text-sm font-semibold">{tabStats.uniqueCustomers}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="block sm:hidden space-y-3">
        {filteredTransactions.slice(0, visibleCount).map((tx) => (
          <div
            key={tx.id}
            className="border border-border/30 rounded-lg p-3 bg-secondary/10 cursor-pointer"
            onClick={() => setSelectedTx(tx)}
          >
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className={cn("font-medium text-xs", typeStyles[tx.type])}>
                {typeLabels[tx.type] || tx.type}
              </Badge>
              <Badge variant="outline" className={cn("font-medium text-xs", statusStyles[tx.status])}>
                {statusLabels[tx.status] || tx.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate max-w-[60%]">
                {tx.customer_name || "-"}
              </span>
              <span className="text-sm font-bold">{formatCurrency(tx.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDate(tx.paid_at || tx.created_at)}</span>
              {activeTab !== "aprovados" && tx.customer_phone && (
                <RecoveryPopover
                  transaction={tx}
                  recoveryMessage={getRecoveryMessage(activeTab)}
                  clickCount={getClickCount(tx.id)}
                  onSendWhatsApp={sendText}
                  onRecoveryClick={() => addClick.mutate({
                    transactionId: tx.id,
                    recoveryType: activeTab === "boletos-gerados" ? "boleto" : tx.type,
                  })}
                  isExtensionConnected={isExtensionConnected}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block">
        <div className="overflow-hidden rounded-lg border border-border/30">
          <table className="w-full">
            <thead className="bg-secondary/30">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tipo
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("customer_name")}
                >
                  Cliente <SortIcon field="customer_name" />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                  Contato
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("created_at")}
                >
                  Data <SortIcon field="created_at" />
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("amount")}
                >
                  Valor <SortIcon field="amount" />
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    {searchQuery ? (
                      <div>
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">Nenhuma transação encontrada</p>
                        <p className="text-sm">Tente buscar com outros termos</p>
                      </div>
                    ) : (
                      <div>
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">Nenhuma transação ainda</p>
                        <p className="text-sm">As transações aparecerão aqui quando chegarem</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, visibleCount).map((tx, index) => (
                  <tr
                    key={tx.id}
                    className="group hover:bg-secondary/40 transition-all duration-200 cursor-pointer"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <td className="py-3.5 px-4">
                      <Badge variant="outline" className={cn("font-medium text-xs", typeStyles[tx.type])}>
                        {typeLabels[tx.type] || tx.type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {tx.customer_name || "-"}
                        </span>
                        {isRealEmail(tx.customer_email) && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {tx.customer_email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 hidden xl:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {tx.customer_phone || "-"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col cursor-help">
                              <span className="text-sm font-medium">
                                {formatRelativeTime(tx.paid_at || tx.created_at)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(tx.paid_at || tx.created_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p>
                                <span className="text-muted-foreground">Criado:</span>{" "}
                                {formatDate(tx.created_at)}
                              </p>
                              {tx.paid_at && (
                                <p>
                                  <span className="text-muted-foreground">Pago:</span>{" "}
                                  {formatDate(tx.paid_at)}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-sm font-bold">{formatCurrency(tx.amount)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant="outline" className={cn("font-medium text-xs", statusStyles[tx.status])}>
                        {statusLabels[tx.status] || tx.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {/* Recovery button for pending tabs */}
                        {activeTab !== "aprovados" && tx.customer_phone && (
                          <RecoveryPopover
                            transaction={tx}
                            recoveryMessage={getRecoveryMessage(activeTab)}
                            clickCount={getClickCount(tx.id)}
                            onSendWhatsApp={sendText}
                            onRecoveryClick={() => addClick.mutate({
                              transactionId: tx.id,
                              recoveryType: activeTab === "boletos-gerados" ? "boleto" : tx.type,
                            })}
                            isExtensionConnected={isExtensionConnected}
                          />
                        )}
                        {tx.payment_url && (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(tx.payment_url!);
                                      toast.success("Link copiado!");
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar link</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(tx.payment_url!, "_blank");
                                    }}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Abrir link</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                        )}
                        <AlertDialog>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Remover</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover transação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover esta transação? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(tx.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Load More */}
          {filteredTransactions.length > visibleCount && (
            <div className="p-3 border-t border-border/30 bg-secondary/10 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + 15)}
                className="text-xs"
              >
                Carregar mais ({filteredTransactions.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Load More */}
      {filteredTransactions.length > visibleCount && (
        <div className="block sm:hidden text-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCount((prev) => prev + 15)}
            className="text-xs"
          >
            Carregar mais ({filteredTransactions.length - visibleCount} restantes)
          </Button>
        </div>
      )}

      <TransactionDetailDialog
        transaction={selectedTx}
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
      />
      </>
      )}
    </div>
  );
}
