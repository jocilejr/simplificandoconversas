import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Trash2, Download, Search, ChevronDown, ChevronUp,
  Users, Clock, CheckCircle2, AlertCircle, RefreshCw,
  CalendarIcon, Copy, ExternalLink, Settings2,
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
import { RecoverySettingsDialog } from "./RecoverySettingsDialog";
import { BoletoRecoveryModal } from "./BoletoRecoveryModal";
import { BoletoQuickRecovery } from "./BoletoQuickRecovery";
import { AutoRecoveryToggle } from "./AutoRecoveryConfig";
import { normalizePhone } from "@/lib/normalizePhone";
import { useUnseenTransactions } from "@/hooks/useUnseenTransactions";

interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onDateFilterChange?: (startDate: Date, endDate: Date) => void;
  dateStart?: Date;
  dateEnd?: Date;
}

type TabKey = "aprovados" | "boletos-gerados" | "pix-cartao-pendentes" | "rejeitados";
type SortField = "created_at" | "amount" | "customer_name";
type SortDirection = "asc" | "desc";
type DatePreset = "today" | "yesterday" | "7days" | "30days" | "custom";

const typeLabels: Record<string, string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
  card: "Cartão",
  yampi: "Yampi",
  yampi_cart: "Carrinho",
};

const statusStyles: Record<string, string> = {
  aprovado: "bg-green-500/20 text-green-600 border-green-500/30",
  pendente: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  abandonado: "bg-orange-500/20 text-orange-600 border-orange-500/30",
  rejeitado: "bg-destructive/20 text-destructive border-destructive/30",
  cancelado: "bg-destructive/20 text-destructive border-destructive/30",
  processando: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  reembolsado: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  estornado: "bg-purple-500/20 text-purple-600 border-purple-500/30",
};

const statusLabels: Record<string, string> = {
  aprovado: "Pago",
  pendente: "Pendente",
  abandonado: "Abandonado",
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
  yampi: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  yampi_cart: "bg-purple-500/20 text-purple-400 border-purple-500/30",
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
  const [boletoTemplateOpen, setBoletoTemplateOpen] = useState(false);
  const [quickRecoveryTx, setQuickRecoveryTx] = useState<Transaction | null>(null);
  const queryClient = useQueryClient();
  const { hasUnseen, markSeen, markTabSeen, markAllSeen } = useUnseenTransactions();
  // Recovery hooks
  const { profile } = useProfile();
  const { sendText, isConnected: isExtensionConnected } = useWhatsAppExtension();

  // Get pending transaction IDs for recovery clicks
  const pendingTxIds = useMemo(() =>
    transactions.filter((t) => t.status === "pendente").map((t) => t.id),
    [transactions]
  );
  const { addClick, getClickCount } = useRecoveryClicks(pendingTxIds);

  const DEFAULT_BOLETO_MSG = `{saudação}, {primeiro_nome}! 😊\n\nVi que seu boleto no valor de {valor} ainda está em aberto. Posso te ajudar com algo?\n\nCaso já tenha pago, pode desconsiderar essa mensagem! 🙏`;
  const DEFAULT_PIX_MSG = `{saudação}, {primeiro_nome}! 😊\n\nNotei que seu pagamento de {valor} via PIX/Cartão está pendente. Precisa de ajuda para finalizar?\n\nSe já realizou o pagamento, por favor desconsidere! 🙏`;
  const DEFAULT_ABANDONED_MSG = `{saudação}, {primeiro_nome}! 😊\n\nVi que você teve um problema com seu pagamento de {valor}. Posso te ajudar a finalizar?\n\nSe já resolveu, pode desconsiderar! 🙏`;

  const getRecoveryMessage = (tab: TabKey) => {
    if (tab === "boletos-gerados") {
      return (profile as any)?.recovery_message_boleto || DEFAULT_BOLETO_MSG;
    }
    if (tab === "pix-cartao-pendentes") {
      return (profile as any)?.recovery_message_pix || DEFAULT_PIX_MSG;
    }
    return (profile as any)?.recovery_message_abandoned || DEFAULT_ABANDONED_MSG;
  };

  const handleRowClick = (tx: Transaction) => {
    if (activeTab === "boletos-gerados") {
      setQuickRecoveryTx(tx);
    } else {
      setSelectedTx(tx);
    }
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
    aprovados: transactions.filter((t) => {
      if (t.status !== "aprovado") return false;
      if (!dateStart || !dateEnd) return true;
      const relevantDate = new Date(t.paid_at || t.created_at);
      return relevantDate >= dateStart && relevantDate <= dateEnd;
    }),
    "boletos-gerados": transactions.filter((t) => t.type === "boleto" && t.status === "pendente"),
    "pix-cartao-pendentes": transactions.filter(
      (t) => (t.type === "pix" || t.type === "cartao" || t.type === "card") && t.status === "pendente"
    ),
    rejeitados: transactions.filter(
      (t) => (t.type === "yampi_cart" && t.status === "abandonado") || t.status === "rejeitado"
    ),
  }), [transactions, dateStart, dateEnd]);

  // Mark transactions as seen when tab is active
  const prevTab = useRef<TabKey | null>(null);

  // On tab change — always mark
  useEffect(() => {
    if (prevTab.current === activeTab) return;
    prevTab.current = activeTab;
    markTabSeen(activeTab);
  }, [activeTab, markTabSeen]);

  // On initial load — mark ALL as seen (clears orphans that no tab covers)
  useEffect(() => {
    if (isLoading) return;
    markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Auto-mark while viewing: if new unseen arrive while user is on tab, mark after 2s
  useEffect(() => {
    if (!hasUnseen(activeTab)) return;
    const timer = setTimeout(() => markTabSeen(activeTab), 2000);
    return () => clearTimeout(timer);
  }, [hasUnseen, activeTab, markTabSeen]);

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
        <div className="flex items-center gap-3">
          <AutoRecoveryToggle />
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            {Math.min(visibleCount, filteredTransactions.length)} de {filteredTransactions.length}
          </span>
        </div>
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
      <div className="flex items-center gap-2 mb-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="flex-1">
          <TabsList className="grid grid-cols-4 gap-1 h-auto p-1">
            <TabsTrigger value="aprovados" onClick={() => markTabSeen("aprovados")} className="text-[10px] sm:text-xs py-2 px-1 sm:px-2 relative">
              Aprovados ({tabTransactions.aprovados.length})
              {hasUnseen("aprovados") && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </TabsTrigger>
            <TabsTrigger value="boletos-gerados" onClick={() => markTabSeen("boletos-gerados")} className="text-[10px] sm:text-xs py-2 px-1 sm:px-2 relative">
              Boletos ({tabTransactions["boletos-gerados"].length})
              {hasUnseen("boletos-gerados") && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </TabsTrigger>
            <TabsTrigger value="pix-cartao-pendentes" onClick={() => markTabSeen("pix-cartao-pendentes")} className="text-[10px] sm:text-xs py-2 px-1 sm:px-2 relative">
              PIX/Cartão ({tabTransactions["pix-cartao-pendentes"].length})
              {hasUnseen("pix-cartao-pendentes") && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </TabsTrigger>
            <TabsTrigger value="rejeitados" onClick={() => markTabSeen("rejeitados")} className="text-[10px] sm:text-xs py-2 px-1 sm:px-2 relative">
              Rejeitados ({tabTransactions.rejeitados.length})
              {hasUnseen("rejeitados") && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {activeTab === "boletos-gerados" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setBoletoTemplateOpen(true)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Configurar templates de recuperação</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {activeTab === "pix-cartao-pendentes" && (
          <RecoverySettingsDialog type="pix" />
        )}
        {activeTab === "rejeitados" && (
          <RecoverySettingsDialog type="abandoned" />
        )}
      </div>

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
            onClick={() => handleRowClick(tx)}
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
                    onClick={() => handleRowClick(tx)}
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
                      <div className="flex items-center gap-1.5">
                        {tx.whatsapp_valid === true && (
                          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" title="WhatsApp válido" />
                        )}
                        {tx.whatsapp_valid === false && (
                          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="WhatsApp inválido" />
                        )}
                        <span className="text-sm text-muted-foreground font-mono">
                          {normalizePhone(tx.customer_phone)}
                        </span>
                      </div>
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
                      {(tx.metadata as any)?.error_reason ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={cn("font-medium text-xs cursor-help", statusStyles[tx.status])}>
                                {statusLabels[tx.status] || tx.status}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs font-medium">Motivo: {(tx.metadata as any).error_reason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge variant="outline" className={cn("font-medium text-xs", statusStyles[tx.status])}>
                          {statusLabels[tx.status] || tx.status}
                        </Badge>
                      )}
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

      <BoletoRecoveryModal
        open={boletoTemplateOpen}
        onOpenChange={setBoletoTemplateOpen}
      />

      <BoletoQuickRecovery
        open={!!quickRecoveryTx}
        onOpenChange={(v) => !v && setQuickRecoveryTx(null)}
        transaction={quickRecoveryTx}
      />
    </div>
  );
}
