import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock, CalendarClock, AlertTriangle, Phone, Copy, CheckCircle2,
  User, DollarSign, FileText, Search, Trash2, Play, Settings2,
  TrendingUp, Send, Timer,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";

export function FollowUpDashboard() {
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const { extensionStatus, sendText } = useWhatsAppExtension();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      <Card><CardContent className="flex items-center justify-center py-12"><div className="animate-pulse text-muted-foreground">Carregando...</div></CardContent></Card>
    );
  }

  const renderTable = (boletos: BoletoWithRecovery[], showProgress = false) => {
    const visible = boletos.slice(0, visibleCount);
    if (boletos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{searchQuery ? "Nenhum boleto encontrado" : "Nenhum boleto nesta categoria"}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {showProgress && stats.totalToday > 0 && (
          <div className="flex items-center gap-3 px-1">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{stats.sentToday}/{stats.totalToday} enviados</span>
          </div>
        )}
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="text-left py-2.5 px-3 font-medium">Cliente</th>
                <th className="text-left py-2.5 px-3 font-medium">Telefone</th>
                <th className="text-right py-2.5 px-3 font-medium">Valor</th>
                <th className="text-left py-2.5 px-3 font-medium">Vencimento</th>
                <th className="text-left py-2.5 px-3 font-medium">Status</th>
                <th className="text-right py-2.5 px-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {visible.map((boleto) => (
                <tr key={boleto.id} className="hover:bg-secondary/40 cursor-pointer transition-colors" onClick={() => setSelectedBoleto(boleto)}>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-secondary/60 flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="font-medium truncate max-w-[160px]">{boleto.customer_name || "Cliente"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{boleto.customer_phone || "—"}</td>
                  <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(boleto.amount)}</td>
                  <td className="py-2.5 px-3">
                    <span className={boleto.isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {format(boleto.dueDate, "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {boleto.contactedToday ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Enviado</Badge>
                    ) : boleto.isOverdue ? (
                      <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Vencido</Badge>
                    ) : boleto.applicableRule ? (
                      <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-600"><Clock className="h-3 w-3" />{boleto.applicableRule.name}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-0.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      {boleto.customer_phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleWhatsApp(boleto.customer_phone!, boleto.formattedMessage || undefined)}>
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
            <div key={boleto.id} className="p-3 rounded-lg border border-border/30 bg-secondary/10 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setSelectedBoleto(boleto)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-secondary/60 flex items-center justify-center shrink-0"><User className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{boleto.customer_name || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(boleto.amount)} · Vence {format(boleto.dueDate, "dd/MM", { locale: ptBR })}</p>
                  </div>
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
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
      {/* Sidebar */}
      <div className="sm:w-64 shrink-0 space-y-4">
        <div className="bg-card border border-border/30 rounded-xl p-4 space-y-4">
          <h2 className="text-lg font-semibold">Follow Up</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-4 w-4 text-primary" /></div>
              <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Total</p><p className="text-base font-bold">{formatCurrency(stats.todayValue)}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center"><Timer className="h-4 w-4 text-amber-500" /></div>
              <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendentes</p><p className="text-base font-bold">{stats.pendingToday}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Send className="h-4 w-4 text-emerald-500" /></div>
              <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enviados</p><p className="text-base font-bold">{stats.sentToday} <span className="text-xs text-muted-foreground font-normal">/ {stats.totalToday}</span></p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
              <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vencidos</p><p className="text-base font-bold">{stats.overdueCount}</p></div>
            </div>
          </div>

          {stats.totalToday > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso do dia</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Button onClick={() => setQueueOpen(true)} className="w-full gap-2 h-9 text-xs" size="sm"><Play className="h-3.5 w-3.5" />Iniciar Recuperação</Button>
            <Button onClick={() => setSettingsOpen(true)} variant="outline" className="w-full gap-2 h-9 text-xs" size="sm"><Settings2 className="h-3.5 w-3.5" />Configurar Régua</Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="bg-card border border-border/30 rounded-xl p-4 sm:p-5">
          <Tabs defaultValue="today" className="w-full" onValueChange={() => setVisibleCount(20)}>
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 gap-1">
              <TabsTrigger value="today" className="text-[10px] sm:text-xs py-2 px-1 sm:px-2 gap-1">
                <Clock className="h-3.5 w-3.5 hidden sm:block" />Hoje
                {stats.totalToday > 0 && <span className="text-[10px] opacity-70">({stats.totalToday})</span>}
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-[10px] sm:text-xs py-2 px-1 sm:px-2 gap-1">
                <CalendarClock className="h-3.5 w-3.5 hidden sm:block" />Pendentes
                {stats.pendingCount > 0 && <span className="text-[10px] opacity-70">({stats.pendingCount})</span>}
              </TabsTrigger>
              <TabsTrigger value="overdue" className="text-[10px] sm:text-xs py-2 px-1 sm:px-2 gap-1">
                <AlertTriangle className="h-3.5 w-3.5 hidden sm:block" />Vencidos
                {stats.overdueCount > 0 && <span className="text-[10px] opacity-70">({stats.overdueCount})</span>}
              </TabsTrigger>
              <TabsTrigger value="all" className="text-[10px] sm:text-xs py-2 px-1 sm:px-2 gap-1">
                <TrendingUp className="h-3.5 w-3.5 hidden sm:block" />Todos
                {stats.totalCount > 0 && <span className="text-[10px] opacity-70">({stats.totalCount})</span>}
              </TabsTrigger>
            </TabsList>

            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome, telefone, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>

            <TabsContent value="today" className="mt-3">{renderTable(filteredTodayBoletos, true)}</TabsContent>
            <TabsContent value="pending" className="mt-3">{renderTable(filteredPendingBoletos)}</TabsContent>
            <TabsContent value="overdue" className="mt-3">{renderTable(filteredOverdueBoletos)}</TabsContent>
            <TabsContent value="all" className="mt-3">{renderTable(filteredAllBoletos)}</TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>Configurar Régua de Cobrança</DialogTitle></DialogHeader>
          <div className="overflow-x-hidden"><FollowUpRulesConfig /></div>
        </DialogContent>
      </Dialog>

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
          {boleto.contactedToday && <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />Já contactado hoje</Badge>}
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
            {!boleto.contactedToday && boleto.applicableRule && <Button variant="secondary" className="flex-1 gap-2" onClick={() => onMarkContacted(boleto.id, boleto.applicableRule?.id)}><CheckCircle2 className="h-4 w-4" />Contactado</Button>}
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
