import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useMessageQueueConfig } from "@/hooks/useMessageQueueConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  WifiOff,
  Trash2,
  Star,
  Link2,
  ServerCrash,
  QrCode,
  RefreshCw,
  RotateCcw,
  MessageSquareX,
  Settings,
  Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

function MessageQueueSection({ instances }: { instances: any[] }) {
  const { configs, upsertConfig } = useMessageQueueConfig();
  const [localValues, setLocalValues] = useState<Record<string, { delay?: string; pauseSends?: string; pauseMin?: string }>>({});

  const activeInstances = instances.filter((i: any) => i.is_active);
  if (activeInstances.length === 0) return null;

  const updateLocal = (name: string, field: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };

  return (
    <div className="border-t border-border pt-6 mt-6 space-y-4">
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          Fila de Mensagens
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          Define o intervalo entre mensagens e pausa automática por instância.
        </p>
      </div>
      <div className="space-y-3">
        {activeInstances.map((inst: any) => {
          const cfg = configs.find((c: any) => c.instance_name === inst.instance_name);
          const currentDelay = cfg?.delay_seconds || 30;
          const currentPauseSends = cfg?.pause_after_sends ?? "";
          const currentPauseMin = cfg?.pause_minutes ?? "";
          const local = localValues[inst.instance_name] || {};

          return (
            <div key={inst.instance_name} className="p-3 rounded-lg border border-border/30 bg-secondary/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full shrink-0 ${inst.status === "open" ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm font-medium flex-1 truncate">{inst.instance_name}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Intervalo</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={5}
                      max={300}
                      value={local.delay ?? String(currentDelay)}
                      onChange={(e) => updateLocal(inst.instance_name, "delay", e.target.value)}
                      className="h-8 text-sm text-center"
                    />
                    <span className="text-[10px] text-muted-foreground shrink-0">seg</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Pausar após</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      placeholder="—"
                      value={local.pauseSends ?? (currentPauseSends !== "" ? String(currentPauseSends) : "")}
                      onChange={(e) => updateLocal(inst.instance_name, "pauseSends", e.target.value)}
                      className="h-8 text-sm text-center"
                    />
                    <span className="text-[10px] text-muted-foreground shrink-0">msgs</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Pausa de</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      placeholder="—"
                      value={local.pauseMin ?? (currentPauseMin !== "" ? String(currentPauseMin) : "")}
                      onChange={(e) => updateLocal(inst.instance_name, "pauseMin", e.target.value)}
                      className="h-8 text-sm text-center"
                    />
                    <span className="text-[10px] text-muted-foreground shrink-0">min</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs"
                disabled={upsertConfig.isPending}
                onClick={() => {
                  const delay = Math.max(5, Math.min(300, parseInt(local.delay || String(currentDelay)) || 30));
                  const pauseSends = local.pauseSends !== undefined
                    ? (local.pauseSends === "" ? null : Math.max(1, parseInt(local.pauseSends) || 1))
                    : (currentPauseSends !== "" ? currentPauseSends : null);
                  const pauseMin = local.pauseMin !== undefined
                    ? (local.pauseMin === "" ? null : Math.max(1, parseInt(local.pauseMin) || 1))
                    : (currentPauseMin !== "" ? currentPauseMin : null);
                  upsertConfig.mutate({
                    instanceName: inst.instance_name,
                    delaySeconds: delay,
                    pauseAfterSends: pauseSends as number | null,
                    pauseMinutes: pauseMin as number | null,
                  }, {
                    onSuccess: () => {
                      toast({ title: "Configuração salva!" });
                      setLocalValues((prev) => {
                        const next = { ...prev };
                        delete next[inst.instance_name];
                        return next;
                      });
                    },
                    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
                  });
                }}
              >
                Salvar
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConnectionsSection() {
  const { workspaceId } = useWorkspace();
  const {
    instances,
    remoteInstances,
    isLoading,
    isRemoteLoading,
    isServerConnected,
    createInstance,
    getQrCode,
    logoutInstance,
    deleteInstance,
    setActiveInstance,
    updateDelay,
  } = useWhatsAppInstances();

  const [showNameDialog, setShowNameDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [qrCode, setQrCode] = useState<{ instanceName: string; base64: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [delayInput, setDelayInput] = useState<Record<string, string>>({});

  const handleCreateInstance = async () => {
    if (!newName.trim()) return;
    await createInstance.mutateAsync(newName.trim());
    setShowNameDialog(false);
    setNewName("");
  };

  const handleGetQrCode = async (instanceName: string) => {
    setLoadingQr(instanceName);
    try {
      const result = await getQrCode.mutateAsync(instanceName);
      const base64 = result?.qrcode?.base64 || result?.base64;
      if (base64) {
        setQrCode({ instanceName, base64 });
      } else {
        toast({
          title: "QR Code não disponível",
          description: "A instância não retornou um QR Code. Tente novamente em alguns segundos.",
          variant: "destructive",
        });
        setQrCode(null);
      }
    } finally {
      setLoadingQr(null);
    }
  };

  const handleLogout = async (instanceName: string) => {
    setLoadingQr(instanceName);
    try {
      const result = await logoutInstance.mutateAsync(instanceName);
      const base64 = result?.qrcode?.base64 || result?.base64;
      if (base64) {
        setQrCode({ instanceName, base64 });
      }
    } finally {
      setLoadingQr(null);
    }
  };

  const handleLinkInstance = async (name: string) => {
    await setActiveInstance.mutateAsync(name);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "sync-chats", workspaceId },
      });
      if (error) throw error;
      toast({
        title: "Sincronização concluída",
        description: `${data?.synced || 0} conversas e ${data?.messagesSynced || 0} mensagens importadas`,
      });
    } catch (e: any) {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-500/15 text-green-400 border-green-500/30";
      case "connecting": return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
      default: return "bg-red-500/15 text-red-400 border-red-500/30";
    }
  };

  const handleDeleteAllConversations = async () => {
    if (!workspaceId) return;
    setDeletingAll(true);
    try {
      // Delete in order: flow_timeouts → flow_executions → tracked_links → messages → conversation_labels → conversations
      const { error: toErr } = await supabase.from("flow_timeouts").delete().eq("workspace_id", workspaceId).neq("id", "00000000-0000-0000-0000-000000000000");
      if (toErr) throw toErr;
      const { error: feErr } = await supabase.from("flow_executions").delete().eq("workspace_id", workspaceId).neq("id", "00000000-0000-0000-0000-000000000000");
      if (feErr) throw feErr;
      const { error: tlErr } = await supabase.from("tracked_links").delete().eq("workspace_id", workspaceId).neq("id", "00000000-0000-0000-0000-000000000000");
      if (tlErr) throw tlErr;
      const { error: msgErr } = await supabase.from("messages").delete().eq("workspace_id", workspaceId).neq("id", "00000000-0000-0000-0000-000000000000");
      if (msgErr) throw msgErr;
      const { error: labelsErr } = await supabase.from("conversation_labels").delete().eq("workspace_id", workspaceId).neq("id", "00000000-0000-0000-0000-000000000000");
      if (labelsErr) throw labelsErr;
      const { error: convErr } = await supabase.from("conversations").delete().eq("workspace_id", workspaceId).neq("id", "00000000-0000-0000-0000-000000000000");
      if (convErr) throw convErr;
      toast({ title: "Conversas excluídas", description: "Todas as conversas foram removidas com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setDeletingAll(false);
      setConfirmDeleteAll(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "Conectada";
      case "connecting": return "Conectando";
      default: return "Desconectada";
    }
  };

  const unlinkedRemote = remoteInstances.filter(
    (ri) => !instances.some((i) => i.instance_name === ri.name)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Conexões WhatsApp</h3>
          <p className="text-sm text-muted-foreground">Gerencie suas instâncias do WhatsApp</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${
              isRemoteLoading ? "bg-yellow-500 animate-pulse" :
              isServerConnected ? "bg-green-500" : "bg-red-500"
            }`} />
            <span className="text-xs text-muted-foreground">
              {isRemoteLoading ? "Verificando..." :
               isServerConnected ? "Servidor online" : "Servidor offline"}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setShowNameDialog(true)}
            disabled={!isServerConnected}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Instância
          </Button>
        </div>
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instância</DialogTitle>
            <DialogDescription>Escolha um nome para identificar esta conexão WhatsApp</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Ex: atendimento, vendas, suporte..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateInstance()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNameDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateInstance} disabled={!newName.trim() || createInstance.isPending}>
              {createInstance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Server offline warning */}
      {!isServerConnected && !isRemoteLoading && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 flex items-center gap-3">
            <ServerCrash className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Servidor não acessível</p>
              <p className="text-xs text-muted-foreground">
                O backend Evolution API não está respondendo. Verifique se os containers estão rodando na VPS.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && instances.length === 0 && unlinkedRemote.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <WifiOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma instância encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Nova Instância" para criar e conectar seu WhatsApp
            </p>
          </CardContent>
        </Card>
      )}

      {/* Linked instances */}
      {instances.map((inst) => (
        <div
          key={inst.id}
          className={`rounded-xl border p-4 transition-all ${
            inst.is_active ? "border-primary/40 bg-primary/5" : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${
                inst.status === "open" ? "bg-green-500" : inst.status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"
              }`} />
              <span className="font-medium text-sm">{inst.instance_name}</span>
              <Badge variant="outline" className={`text-[10px] ${getStatusColor(inst.status)}`}>
                {getStatusLabel(inst.status)}
              </Badge>
              {inst.is_active && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                  <Star className="h-3 w-3 mr-1" /> Ativa
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {inst.status !== "open" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleGetQrCode(inst.instance_name)}
                  disabled={loadingQr === inst.instance_name}
                  className="text-xs"
                >
                  {loadingQr === inst.instance_name ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <QrCode className="h-3.5 w-3.5 mr-1" />
                  )}
                  QR Code
                </Button>
              )}
              {inst.status === "open" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLogout(inst.instance_name)}
                  disabled={loadingQr === inst.instance_name}
                  className="text-xs"
                >
                  {loadingQr === inst.instance_name ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  )}
                  Reconexão
                </Button>
              )}
              {inst.status === "open" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="text-xs"
                >
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  )}
                  Sincronizar
                </Button>
              )}
              {!inst.is_active && (
                <Button variant="ghost" size="sm" onClick={() => setActiveInstance.mutate(inst.instance_name)} disabled={setActiveInstance.isPending} className="text-xs">
                  <Star className="h-3.5 w-3.5 mr-1" /> Ativar
                </Button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const current = ((inst as any).message_delay_ms || 2000) / 1000;
                      setDelayInput((prev) => ({ ...prev, [inst.instance_name]: String(current) }));
                    }}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Intervalo entre mensagens</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        step={0.5}
                        value={delayInput[inst.instance_name] ?? String(((inst as any).message_delay_ms || 2000) / 1000)}
                        onChange={(e) => setDelayInput((prev) => ({ ...prev, [inst.instance_name]: e.target.value }))}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">seg</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => {
                        const val = parseFloat(delayInput[inst.instance_name] || "2");
                        const clamped = Math.min(10, Math.max(1, val));
                        updateDelay.mutate({ instanceName: inst.instance_name, delayMs: clamped * 1000 });
                      }}
                      disabled={updateDelay.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(inst.instance_name)} disabled={deleteInstance.isPending} className="text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Unlinked remote instances */}
      {unlinkedRemote.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Instâncias disponíveis no servidor</h4>
          {unlinkedRemote.map((ri) => (
            <div key={ri.name} className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  ri.status === "open" ? "bg-green-500" : "bg-red-500"
                }`} />
                <span className="text-sm">{ri.name}</span>
                {ri.profileName && <span className="text-xs text-muted-foreground">{ri.profileName}</span>}
                <Badge variant="outline" className={`text-[10px] ${getStatusColor(ri.status)}`}>
                  {getStatusLabel(ri.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleLinkInstance(ri.name)}
                  disabled={setActiveInstance.isPending}
                >
                  <Link2 className="h-3.5 w-3.5 mr-1" /> Vincular
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(ri.name)}
                  disabled={deleteInstance.isPending}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code display */}
      {qrCode && (
        <Card className="border-primary/30">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium mb-3">
              Escaneie o QR Code para conectar <span className="text-primary">{qrCode.instanceName}</span>
            </p>
            <img
              src={qrCode.base64.startsWith("data:") ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
              alt="QR Code WhatsApp"
              className="mx-auto w-64 h-64 rounded-lg"
            />
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => setQrCode(null)}>
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a instância <strong>{confirmDelete}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) {
                  deleteInstance.mutate(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message Queue Config */}
      <MessageQueueSection instances={instances} />

      {/* Delete all conversations section */}
      <div className="border-t border-border pt-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-destructive">Zona de Perigo</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Exclua todas as conversas e mensagens para reimportar do zero.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDeleteAll(true)}
            disabled={deletingAll}
          >
            {deletingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquareX className="h-4 w-4 mr-2" />}
            Excluir Todas as Conversas
          </Button>
        </div>
      </div>

      {/* Delete all conversations confirmation */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todas as conversas</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai remover <strong>TODAS</strong> as conversas, mensagens e etiquetas de conversa. 
              Isso não pode ser desfeito. Você poderá reimportar usando o botão "Sincronizar".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAllConversations}
            >
              {deletingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sim, excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
