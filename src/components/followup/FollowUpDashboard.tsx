import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useBoletoRecovery, BoletoWithRecovery } from "@/hooks/useBoletoRecovery";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { supabase } from "@/integrations/supabase/client";
import { FollowUpRulesConfig } from "./FollowUpRulesConfig";
import { FollowUpQueue } from "./FollowUpQueue";
import { FollowUpSettingsDialog } from "./FollowUpSettingsDialog";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock, CalendarClock, AlertTriangle, Phone, Copy, CheckCircle2,
  User, DollarSign, FileText, Search, Trash2, Play, Settings2,
  Send, Timer, RefreshCw, Zap,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";

export function FollowUpDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { extensionStatus, sendText } = useWhatsAppExtension();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoSettingsOpen, setAutoSettingsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<BoletoWithRecovery | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  const {
    todayBoletos, pendingTodayBoletos, pendingBoletos,
    overdueBoletos, processedBoletos, stats, addContact, isLoading,
  } = useBoletoRecovery();

  const filterBoletos = (boletos: BoletoWithRecovery[]) => {
    if (!searchQuery.trim()) return boletos;
    const q = searchQuery.toLowerCase().trim();
    return boletos.filter((b) =>
      (b.customer_name?.toLowerCase() || "").includes(q) ||
      (b.customer_phone?.toLowerCase() || "").includes(q) ||
      (b.customer_email?.toLowerCase() || "").includes(q) ||
      (b.external_id?.toLowerCase() || "").includes(q)
    );
  };

  const filteredTodayBoletos = useMemo(() => filterBoletos(todayBoletos), [todayBoletos, searchQuery]);
  const filteredPendingBoletos = useMemo(() => filterBoletos(pendingBoletos), [pendingBoletos, searchQuery]);
  const filteredOverdueBoletos = useMemo(() => filterBoletos(overdueBoletos), [overdueBoletos, searchQuery]);
  const filteredAllBoletos = useMemo(() => filterBoletos(processedBoletos), [processedBoletos, searchQuery]);

  const handleMarkContacted = (transactionId: string, ruleId?: string, notes?: string) => {
    addContact.mutate({ transactionId, ruleId, notes }, {
      onSuccess: () => toast({ title: "Sucesso", description: "Contato registrado" }),
      onError: () => toast({ title: "Erro", description: "Não foi possível registrar", variant: "destructive" }),
    });
  };

  const handleWhatsApp = async (phone: string, message?: string) => {
    if (extensionStatus !== "connected") { toast({ title: "Erro", description: "Extensão WhatsApp não detectada", variant: "destructive" }); return; }
    const norm = phone.replace(/\D/g, "").replace(/^0+/, "");
    const full = norm.startsWith("55") ? norm : `55${norm}`;
    await sendText(full, message || "");
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const progressPercent = stats.totalToday > 0 ? Math.round((stats.sentToday / stats.totalToday) * 100) : 0;

  if (isLoading) {
    return (
      <div className="bg-card border border-border/30 rounded-xl p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
        </div>
      </div>
    );
  }

  const renderTable = (boletos: BoletoWithRecovery[]) => {
    const visible = boletos.slice(0, visibleCount);
    if (boletos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{searchQuery ? "Nenhum boleto encontrado" : "Nenhum boleto nesta categoria"}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {/* Desktop table */}
        <div className="hidden md:block overflow-hidden rounded-lg border border-border/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vencimento</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {visible.map((boleto) => (
                <tr key={boleto.id} className="hover:bg-secondary/40 cursor-pointer transition-colors" onClick={() => setSelectedBoleto(boleto)}>
                  <td className="py-3 px-4">
                    <span className="font-medium truncate max-w-[200px] block">{boleto.customer_name || "Cliente"}</span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{boleto.customer_phone || "—"}</td>
                  <td className="py-3 px-4 text-right font-semibold">{formatCurrency(boleto.amount)}</td>
                  <td className="py-3 px-4">
                    <span className={boleto.isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {format(boleto.dueDate, "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {boleto.contactedToday ? (
                      <Badge variant="outline" className="bg-green-500/15 text-green-500 border-green-500/25 text-[10px] gap-1 font-medium"><CheckCircle2 className="h-3 w-3" />Enviado</Badge>
                    ) : boleto.isOverdue ? (
                      <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/25 text-[10px] gap-1 font-medium"><AlertTriangle className="h-3 w-3" />Vencido</Badge>
                    ) : boleto.applicableRule ? (
                      <Badge variant="outline" className="bg-primary/15 text-primary border-primary/25 text-[10px] gap-1 font-medium"><Clock className="h-3 w-3" />{boleto.applicableRule.name}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/25 text-[10px] font-medium">Pendente</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-0.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      {boleto.customer_phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => handleWhatsApp(boleto.customer_phone!, boleto.formattedMessage || undefined)}>
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {boleto.external_id && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(boleto.external_id!); toast({ title: "Copiado!" }); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(boleto.metadata as any)?.boleto_url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open((boleto.metadata as any).boleto_url, "_blank")}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {visible.map((boleto) => (
            <div key={boleto.id} className="p-3 rounded-lg border border-border/30 bg-card cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setSelectedBoleto(boleto)}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{boleto.customer_name || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(boleto.amount)} · Vence {format(boleto.dueDate, "dd/MM", { locale: ptBR })}</p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {boleto.customer_phone && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleWhatsApp(boleto.customer_phone!, boleto.formattedMessage || undefined)}><Phone className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {boletos.length > visibleCount && (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setVisibleCount((c) => c + 20)}>Mostrar mais ({boletos.length - visibleCount} restantes)</Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border/30 rounded-xl p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">Follow Up</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => queryClient.invalidateQueries({ queryKey: ["unpaid-boletos"] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAutoSettingsOpen(true)} variant="outline" size="sm" className="gap-2 h-8 text-xs">
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Automático</span>
          </Button>
          <Button onClick={() => setSettingsOpen(true)} variant="outline" size="sm" className="gap-2 h-8 text-xs">
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Régua</span>
          </Button>
          <Button onClick={() => setQueueOpen(true)} size="sm" className="gap-2 h-8 text-xs">
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Iniciar</span>
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="p-4 bg-secondary/20 rounded-lg border border-border/30">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-primary">{formatCurrency(stats.todayValue)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Em jogo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.totalToday}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total hoje</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Send className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold"><span className="text-green-500">{stats.sentToday}</span><span className="text-muted-foreground text-sm font-normal">/{stats.totalToday}</span></p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enviados</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Timer className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.pendingToday}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendentes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className={`text-lg font-bold ${stats.overdueCount > 0 ? "text-destructive" : ""}`}>{stats.overdueCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vencidos</p>
            </div>
          </div>
        </div>

        {stats.totalToday > 0 && (
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/20">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{progressPercent}% do dia</span>
          </div>
        )}
      </div>

      {/* Tabs + Search + Table */}
      <Tabs defaultValue="today" className="w-full" onValueChange={() => setVisibleCount(20)}>
        <TabsList className="grid w-full grid-cols-4 h-auto p-1 gap-1">
          <TabsTrigger value="today" className="text-xs py-2 px-2">
            Hoje {stats.totalToday > 0 && <span className="text-[10px] opacity-70 ml-1">({stats.totalToday})</span>}
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs py-2 px-2">
            Pendentes {stats.pendingCount > 0 && <span className="text-[10px] opacity-70 ml-1">({stats.pendingCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="text-xs py-2 px-2">
            Vencidos {stats.overdueCount > 0 && <span className="text-[10px] opacity-70 ml-1">({stats.overdueCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs py-2 px-2">
            Todos {stats.totalCount > 0 && <span className="text-[10px] opacity-70 ml-1">({stats.totalCount})</span>}
          </TabsTrigger>
        </TabsList>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>

        <TabsContent value="today" className="mt-3">{renderTable(filteredTodayBoletos)}</TabsContent>
        <TabsContent value="pending" className="mt-3">{renderTable(filteredPendingBoletos)}</TabsContent>
        <TabsContent value="overdue" className="mt-3">{renderTable(filteredOverdueBoletos)}</TabsContent>
        <TabsContent value="all" className="mt-3">{renderTable(filteredAllBoletos)}</TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>Configurar Régua de Cobrança</DialogTitle></DialogHeader>
          <div className="overflow-x-hidden"><FollowUpRulesConfig /></div>
        </DialogContent>
      </Dialog>

      <FollowUpSettingsDialog open={autoSettingsOpen} onOpenChange={setAutoSettingsOpen} />

      <FollowUpQueue open={queueOpen} onOpenChange={setQueueOpen} boletos={pendingTodayBoletos} onMarkContacted={handleMarkContacted} />

      {selectedBoleto && <BoletoDetailDialog boleto={selectedBoleto} onClose={() => setSelectedBoleto(null)} onMarkContacted={handleMarkContacted} />}
    </div>
  );
}

// ── Boleto Detail Dialog ──
function BoletoDetailDialog({ boleto, onClose, onMarkContacted }: { boleto: BoletoWithRecovery; onClose: () => void; onMarkContacted: (transactionId: string, ruleId?: string) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { extensionStatus, sendText } = useWhatsAppExtension();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleWhatsApp = async () => {
    if (!boleto.customer_phone) return;
    if (extensionStatus !== "connected") { toast({ title: "Erro", description: "Extensão WhatsApp não detectada", variant: "destructive" }); return; }
    const phone = boleto.customer_phone.replace(/\D/g, "").replace(/^0+/, "");
    const full = phone.startsWith("55") ? phone : `55${phone}`;
    await sendText(full, boleto.formattedMessage || "");
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", boleto.id);
      if (error) throw error;
      toast({ title: "Deletado", description: "Boleto removido do sistema" });
      await queryClient.invalidateQueries({ queryKey: ["unpaid-boletos"] });
      setDeleteDialogOpen(false);
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível deletar", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><User className="h-5 w-5" />{boleto.customer_name || "Cliente"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{boleto.customer_phone || "Sem telefone"}</span></div>
            <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{formatCurrency(boleto.amount)}</span></div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>Gerado {formatDistanceToNow(new Date(boleto.created_at), { locale: ptBR, addSuffix: true })}</span></div>
            <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-muted-foreground" /><span>Vence {format(boleto.dueDate, "dd/MM/yyyy", { locale: ptBR })}</span></div>
          </div>
          {boleto.contactedToday && <Badge variant="outline" className="bg-green-500/15 text-green-500 border-green-500/25 gap-1"><CheckCircle2 className="h-3 w-3" />Já contactado hoje</Badge>}
          {boleto.external_id && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground">Código de barras</span><Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(boleto.external_id!); toast({ title: "Copiado!" }); }}><Copy className="h-3 w-3" />Copiar</Button></div>
              <p className="font-mono text-xs break-all">{boleto.external_id}</p>
            </div>
          )}
          {boleto.formattedMessage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">Mensagem</span><Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(boleto.formattedMessage!); toast({ title: "Copiado!" }); }}><Copy className="h-3 w-3" />Copiar</Button></div>
              <div className="p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">{boleto.formattedMessage}</div>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleWhatsApp} className="flex-1 gap-2" disabled={!boleto.customer_phone}><Phone className="h-4 w-4" />WhatsApp</Button>
            {!boleto.contactedToday && boleto.applicableRule && <Button variant="outline" className="flex-1 gap-2" onClick={() => onMarkContacted(boleto.id, boleto.applicableRule?.id)}><CheckCircle2 className="h-4 w-4" />Contactado</Button>}
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </DialogContent>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Deletar boleto?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground">{isDeleting ? "Deletando..." : "Deletar"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
