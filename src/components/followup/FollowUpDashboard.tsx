import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useBoletoRecovery, BoletoWithRecovery } from "@/hooks/useBoletoRecovery";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { supabase } from "@/integrations/supabase/client";
import { FollowUpHeroCard } from "./FollowUpHeroCard";
import { FollowUpRulesConfig } from "./FollowUpRulesConfig";
import { FollowUpQueue } from "./FollowUpQueue";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock, CalendarClock, AlertTriangle, Phone, Copy, CheckCircle2,
  User, DollarSign, FileText, List, Search, Trash2,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<BoletoWithRecovery | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  if (isLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-12"><div className="animate-pulse text-muted-foreground">Carregando...</div></CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <FollowUpHeroCard
        totalToday={stats.totalToday}
        todayValue={stats.todayValue}
        sentToday={stats.sentToday}
        resolvedToday={stats.resolvedToday}
        pendingToday={stats.pendingToday}
        onStartRecovery={() => setQueueOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="today" className="gap-2">
            <Clock className="h-4 w-4" />Hoje
            {stats.totalToday > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{stats.totalToday}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <CalendarClock className="h-4 w-4" />Pendentes
            {stats.pendingCount > 0 && <Badge variant="outline" className="ml-1 h-5 px-1.5">{stats.pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-2">
            <AlertTriangle className="h-4 w-4" />Vencidos
            {stats.overdueCount > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{stats.overdueCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <List className="h-4 w-4" />Todos
            {stats.totalCount > 0 && <Badge variant="outline" className="ml-1 h-5 px-1.5">{stats.totalCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone, email ou código de barras..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>

        <TabsContent value="today" className="mt-4">
          <BoletoList boletos={filteredTodayBoletos} emptyMessage={searchQuery ? "Nenhum boleto encontrado" : "Nenhum boleto para contatar hoje"} emptyIcon={<CheckCircle2 className="h-12 w-12 text-emerald-500" />} onSelect={setSelectedBoleto} onMarkContacted={handleMarkContacted} showContactedBadge />
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <BoletoList boletos={filteredPendingBoletos} emptyMessage={searchQuery ? "Nenhum boleto encontrado" : "Nenhum boleto pendente"} emptyIcon={<CalendarClock className="h-12 w-12 text-muted-foreground" />} onSelect={setSelectedBoleto} onMarkContacted={handleMarkContacted} />
        </TabsContent>
        <TabsContent value="overdue" className="mt-4">
          <BoletoList boletos={filteredOverdueBoletos} emptyMessage={searchQuery ? "Nenhum boleto encontrado" : "Nenhum boleto vencido"} emptyIcon={<AlertTriangle className="h-12 w-12 text-muted-foreground" />} onSelect={setSelectedBoleto} onMarkContacted={handleMarkContacted} showOverdueWarning />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <BoletoList boletos={filteredAllBoletos} emptyMessage={searchQuery ? "Nenhum boleto encontrado" : "Nenhum boleto no sistema"} emptyIcon={<List className="h-12 w-12 text-muted-foreground" />} onSelect={setSelectedBoleto} onMarkContacted={handleMarkContacted} />
        </TabsContent>
      </Tabs>

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

// ── Boleto List ──
interface BoletoListProps {
  boletos: BoletoWithRecovery[];
  emptyMessage: string;
  emptyIcon: React.ReactNode;
  onSelect: (boleto: BoletoWithRecovery) => void;
  onMarkContacted: (transactionId: string, ruleId?: string) => void;
  showOverdueWarning?: boolean;
  showContactedBadge?: boolean;
}

function BoletoList({ boletos, emptyMessage, emptyIcon, onSelect, onMarkContacted, showOverdueWarning, showContactedBadge }: BoletoListProps) {
  const { toast } = useToast();
  const { extensionStatus, sendText } = useWhatsAppExtension();
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleWhatsApp = async (phone: string, message?: string) => {
    if (extensionStatus !== "connected") { toast({ title: "Erro", description: "Extensão WhatsApp não detectada", variant: "destructive" }); return; }
    const norm = phone.replace(/\D/g, "").replace(/^0+/, "");
    const full = norm.startsWith("55") ? norm : `55${norm}`;
    await sendText(full, message || "");
  };

  if (boletos.length === 0) {
    return <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center">{emptyIcon}<p className="text-muted-foreground mt-4">{emptyMessage}</p></CardContent></Card>;
  }

  return (
    <Card>
      <ScrollArea className="h-[500px]">
        <div className="p-4 space-y-3">
          {boletos.map((boleto) => (
            <Card key={boleto.id} className={`cursor-pointer transition-all hover:border-primary/50 ${showOverdueWarning ? "border-destructive/30" : ""}`} onClick={() => onSelect(boleto)}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0"><User className="h-5 w-5 text-muted-foreground" /></div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{boleto.customer_name || "Cliente"}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <span>{formatCurrency(boleto.amount)}</span><span>•</span>
                        <span>Gerado {format(new Date(boleto.created_at), "dd/MM", { locale: ptBR })}</span><span>•</span>
                        <span>{boleto.isOverdue ? `Vencido há ${Math.abs(boleto.daysUntilDue)} dia${Math.abs(boleto.daysUntilDue) > 1 ? "s" : ""}` : boleto.daysUntilDue === 0 ? "Vence hoje" : `Vence em ${boleto.daysUntilDue} dia${boleto.daysUntilDue > 1 ? "s" : ""}`}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {showContactedBadge && boleto.contactedToday && <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Enviado</Badge>}
                    {showContactedBadge && !boleto.contactedToday && boleto.applicableRule && <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />Pendente</Badge>}
                    {boleto.applicableRule && <Badge variant="outline" className="text-xs">{boleto.applicableRule.name}</Badge>}
                    <div className="flex gap-1">
                      {(boleto.metadata as any)?.boleto_url && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.open((boleto.metadata as any).boleto_url, "_blank"); }}><FileText className="h-4 w-4" /></Button>}
                      {boleto.external_id && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(boleto.external_id!); toast({ title: "Copiado!" }); }}><Copy className="h-4 w-4" /></Button>}
                      {boleto.customer_phone && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleWhatsApp(boleto.customer_phone!, boleto.formattedMessage || undefined); }}><Phone className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ── Boleto Detail Dialog ──
function BoletoDetailDialog({ boleto, onClose, onMarkContacted }: { boleto: BoletoWithRecovery; onClose: () => void; onMarkContacted: (transactionId: string, ruleId?: string) => void; }) {
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
