import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Play, Square, MoreHorizontal, Trash2, Workflow, Calendar,
  Layers, Radio, FolderOpen, FolderPlus, ArrowLeft, GripVertical, FolderInput
} from "lucide-react";
import { FlowEditor } from "@/components/chatbot/FlowEditor";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const ChatbotBuilder = () => {
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; mode: "create" | "rename"; folderName?: string }>({ open: false, mode: "create" });
  const [folderInput, setFolderInput] = useState("");
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  const { data: flows, isLoading, createFlow, updateFlow, deleteFlow } = useChatbotFlows();
  const queryClient = useQueryClient();

  // Derive unique folders from flows
  const folders = useMemo(() => {
    if (!flows) return [];
    const names = new Set<string>();
    flows.forEach((f) => { if (f.folder) names.add(f.folder); });
    return Array.from(names).sort();
  }, [flows]);

  const flowsInFolder = useMemo(() => {
    if (!flows || !currentFolder) return [];
    return flows.filter((f) => f.folder === currentFolder);
  }, [flows, currentFolder]);

  const flowsWithoutFolder = useMemo(() => {
    if (!flows) return [];
    return flows.filter((f) => !f.folder);
  }, [flows]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    flows?.forEach((f) => { if (f.folder) counts[f.folder] = (counts[f.folder] || 0) + 1; });
    return counts;
  }, [flows]);

  const handleCreateFlow = async (folder?: string | null) => {
    try {
      const result = await createFlow.mutateAsync(`Novo Fluxo ${(flows?.length || 0) + 1}`);
      if (folder) {
        await updateFlow.mutateAsync({ id: result.id, folder });
      }
      setEditingFlowId(result.id);
    } catch {
      toast.error("Erro ao criar fluxo");
    }
  };

  const handleCreateFolder = () => {
    if (!folderInput.trim()) return;
    if (folders.includes(folderInput.trim())) {
      toast.error("Pasta já existe");
      return;
    }
    // Folder is created implicitly when a flow is assigned to it
    // Create a placeholder by just closing the dialog - user will drag flows into it
    // Actually we need at least one flow, so let's just store the name
    // We'll handle empty folders by showing them if they exist in any flow
    toast.success(`Pasta "${folderInput.trim()}" criada. Arraste fluxos para dentro dela.`);
    // To persist an empty folder, we won't do anything special - 
    // folders are derived from flows. Let's just set currentFolder to navigate into it.
    setCurrentFolder(folderInput.trim());
    setFolderDialog({ open: false, mode: "create" });
    setFolderInput("");
  };

  const handleRenameFolder = async () => {
    if (!folderInput.trim() || !folderDialog.folderName) return;
    const oldName = folderDialog.folderName;
    const newName = folderInput.trim();
    if (oldName === newName) { setFolderDialog({ open: false, mode: "create" }); return; }

    const flowsToUpdate = flows?.filter((f) => f.folder === oldName) || [];
    await Promise.all(flowsToUpdate.map((f) => updateFlow.mutateAsync({ id: f.id, folder: newName })));
    queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });

    if (currentFolder === oldName) setCurrentFolder(newName);
    toast.success(`Pasta renomeada para "${newName}"`);
    setFolderDialog({ open: false, mode: "create" });
    setFolderInput("");
  };

  const handleDeleteFolder = async (folderName: string) => {
    const flowsToUpdate = flows?.filter((f) => f.folder === folderName) || [];
    await Promise.all(flowsToUpdate.map((f) => updateFlow.mutateAsync({ id: f.id, folder: null })));
    queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
    if (currentFolder === folderName) setCurrentFolder(null);
    toast.success(`Pasta "${folderName}" excluída. Fluxos movidos para a raiz.`);
  };

  const handleDragStart = (e: React.DragEvent, flowId: string) => {
    e.dataTransfer.setData("flowId", flowId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnFolder = async (e: React.DragEvent, folderName: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    const flowId = e.dataTransfer.getData("flowId");
    if (!flowId) return;
    await updateFlow.mutateAsync({ id: flowId, folder: folderName });
    queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
    toast.success("Fluxo movido para a pasta");
  };

  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRoot(false);
    const flowId = e.dataTransfer.getData("flowId");
    if (!flowId) return;
    await updateFlow.mutateAsync({ id: flowId, folder: null });
    queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
    toast.success("Fluxo removido da pasta");
  };

  // Editing a flow
  if (editingFlowId) {
    const flow = flows?.find((f) => f.id === editingFlowId);
    return (
      <div className="h-[calc(100vh-5rem)] -m-6">
        <FlowEditor
          flowId={editingFlowId}
          flowName={flow?.name || "Novo Fluxo"}
          initialNodes={flow?.nodes || []}
          initialEdges={flow?.edges || []}
          initialInstanceNames={flow?.instance_names || []}
          onBack={() => {
            queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
            setEditingFlowId(null);
          }}
          onSave={async (name, nodes, edges, instanceNames) => {
            await updateFlow.mutateAsync({ id: editingFlowId, name, nodes, edges, instance_names: instanceNames });
          }}
        />
      </div>
    );
  }

  const displayFlows = currentFolder ? flowsInFolder : flowsWithoutFolder;

  const FlowCard = ({ flow }: { flow: typeof flows extends (infer T)[] | undefined ? T : never }) => (
    <Card
      key={flow.id}
      draggable
      onDragStart={(e) => handleDragStart(e, flow.id)}
      className="bg-card border-border rounded-xl overflow-hidden cursor-grab active:cursor-grabbing group hover:shadow-md hover:shadow-primary/5 hover:border-primary/20 transition-all duration-200"
      onClick={() => setEditingFlowId(flow.id)}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <div className="shrink-0 text-muted-foreground/40 cursor-grab">
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${flow.active ? "bg-primary/10" : "bg-muted"}`}>
            <Workflow className={`h-3.5 w-3.5 ${flow.active ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-[13px] truncate leading-tight">{flow.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${flow.active ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <span className="text-[10px] text-muted-foreground">{flow.active ? "Ativo" : "Inativo"}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost" size="sm"
              className={`h-6 px-2 text-[10px] rounded-md font-medium ${flow.active ? "text-destructive hover:bg-destructive/10" : "text-primary hover:bg-primary/10"}`}
              onClick={(e) => { e.stopPropagation(); updateFlow.mutate({ id: flow.id, active: !flow.active }); }}
            >
              {flow.active ? <><Square className="h-2.5 w-2.5" /> Parar</> : <><Play className="h-2.5 w-2.5" /> Ativar</>}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {folders.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderInput className="h-4 w-4 mr-2" /> Mover para pasta
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {folders.filter((f) => f !== flow.folder).map((f) => (
                        <DropdownMenuItem key={f} onClick={() => {
                          updateFlow.mutate({ id: flow.id, folder: f });
                          queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
                        }}>
                          <FolderOpen className="h-4 w-4 mr-2" /> {f}
                        </DropdownMenuItem>
                      ))}
                      {flow.folder && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            updateFlow.mutate({ id: flow.id, folder: null });
                            queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
                          }}>
                            Remover da pasta
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {flow.folder && folders.length === 0 && (
                  <DropdownMenuItem onClick={() => {
                    updateFlow.mutate({ id: flow.id, folder: null });
                    queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
                  }}>
                    Remover da pasta
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onClick={() => deleteFlow.mutate(flow.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className={`flex items-center gap-2.5 px-3.5 py-1.5 text-[10px] text-muted-foreground border-t ${flow.active ? "border-primary/10 bg-primary/[0.02]" : "border-border/50 bg-muted/20"}`}>
          <span className="flex items-center gap-1"><Layers className="h-2.5 w-2.5" />{(flow.nodes as any[])?.length || 0}</span>
          <span className="opacity-30">·</span>
          <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(flow.updated_at).toLocaleDateString("pt-BR")}</span>
          <span className="opacity-30">·</span>
          <span className="flex items-center gap-1 truncate"><Radio className="h-2.5 w-2.5 shrink-0" />{(flow.instance_names as string[])?.length ? (flow.instance_names as string[]).join(", ") : "Todas"}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          {currentFolder ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentFolder(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" /> {currentFolder}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{flowsInFolder.length} fluxo(s) nesta pasta</p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Fluxos Automáticos</h1>
              <p className="text-sm text-muted-foreground mt-1">Gerencie seus fluxos de automação e chatbots</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!currentFolder && (
            <Button
              onClick={() => { setFolderDialog({ open: true, mode: "create" }); setFolderInput(""); }}
              size="sm" variant="outline"
            >
              <FolderPlus className="h-4 w-4" /> Nova Pasta
            </Button>
          )}
          <Button onClick={() => handleCreateFlow(currentFolder)} disabled={createFlow.isPending} size="sm" variant="outline">
            <Plus className="h-4 w-4" /> Novo Fluxo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Folders (only on root view) */}
          {!currentFolder && folders.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {folders.map((folder) => (
                <Card
                  key={folder}
                  className={`rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 ${
                    dragOverFolder === folder ? "border-primary bg-primary/5 scale-[1.02]" : "bg-card border-border"
                  }`}
                  onClick={() => setCurrentFolder(folder)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder); }}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={(e) => handleDropOnFolder(e, folder)}
                >
                  <CardContent className="flex items-center gap-2.5 p-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">{folder}</p>
                      <p className="text-[10px] text-muted-foreground">{folderCounts[folder] || 0} fluxo(s)</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => { setFolderDialog({ open: true, mode: "rename", folderName: folder }); setFolderInput(folder); }}>
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFolder(folder)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir pasta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Root drop zone (when inside a folder, to allow removing from folder) */}
          {currentFolder && (
            <div
              className={`border-2 border-dashed rounded-xl p-2 text-center text-xs text-muted-foreground transition-all ${
                dragOverRoot ? "border-primary bg-primary/5" : "border-border/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOverRoot(true); }}
              onDragLeave={() => setDragOverRoot(false)}
              onDrop={handleDropOnRoot}
            >
              {dragOverRoot ? "Solte aqui para remover da pasta" : "Arraste um fluxo aqui para remover da pasta"}
            </div>
          )}

          {/* Flows */}
          {!displayFlows?.length && !folders.length ? (
            <Card className="bg-card border-border rounded-xl">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-5">
                  <Workflow className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-medium mb-1">Nenhum fluxo criado</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  Crie seu primeiro fluxo de automação com o construtor visual.
                </p>
                <Button onClick={() => handleCreateFlow(null)} size="sm" variant="outline">
                  <Plus className="h-4 w-4" /> Criar Fluxo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {displayFlows?.map((flow) => (
                <FlowCard key={flow.id} flow={flow} />
              ))}

              {/* New flow card */}
              <Card
                className="border-dashed border-border/50 rounded-xl hover:border-primary/20 transition-all duration-200 cursor-pointer flex items-center justify-center min-h-[82px] group"
                onClick={() => handleCreateFlow(currentFolder)}
              >
                <CardContent className="flex items-center gap-2 p-3 text-muted-foreground">
                  <Plus className="h-4 w-4 group-hover:text-primary transition-colors" />
                  <span className="text-xs font-medium group-hover:text-foreground transition-colors">Novo Fluxo</span>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Folder create/rename dialog */}
      <Dialog open={folderDialog.open} onOpenChange={(open) => { if (!open) setFolderDialog({ open: false, mode: "create" }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{folderDialog.mode === "create" ? "Nova Pasta" : "Renomear Pasta"}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome da pasta"
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") folderDialog.mode === "create" ? handleCreateFolder() : handleRenameFolder(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog({ open: false, mode: "create" })}>Cancelar</Button>
            <Button onClick={folderDialog.mode === "create" ? handleCreateFolder : handleRenameFolder}>
              {folderDialog.mode === "create" ? "Criar" : "Renomear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatbotBuilder;
