import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Play, Square, MoreHorizontal, Trash2, Workflow, Calendar, Layers, Radio, Download, Upload } from "lucide-react";
import { FlowEditor } from "@/components/chatbot/FlowEditor";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { exportFlow, importFlowFromFile } from "@/lib/flowExportImport";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ChatbotBuilder = () => {
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const { data: flows, isLoading, createFlow, updateFlow, deleteFlow } = useChatbotFlows();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleCreateFlow = async () => {
    try {
      const result = await createFlow.mutateAsync(`Novo Fluxo ${(flows?.length || 0) + 1}`);
      setEditingFlowId(result.id);
    } catch {
      toast.error("Erro ao criar fluxo");
    }
  };

  const handleExportFlow = async (flow: any) => {
    await exportFlow({
      name: flow.name,
      nodes: flow.nodes as any[],
      edges: flow.edges as any[],
      instance_names: flow.instance_names as string[],
    });
  };

  const uploadMediaFn = async (file: File, filename: string): Promise<string | null> => {
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data } = await supabase.functions.invoke("whatsapp-proxy", {
        body: {
          action: "media-upload",
          userId: user?.id,
          fileName: filename,
          fileBase64: base64,
          mimeType: file.type,
        },
      });

      return data?.url || null;
    } catch {
      return null;
    }
  };

  const handleImportFlow = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    const result = await importFlowFromFile(file, uploadMediaFn);
    if (!result) return;

    try {
      const created = await createFlow.mutateAsync(result.name);
      await updateFlow.mutateAsync({
        id: created.id,
        name: result.name,
        nodes: result.nodes,
        edges: result.edges,
        instance_names: result.instanceNames,
      });
      queryClient.invalidateQueries({ queryKey: ["chatbot-flows"] });
      setEditingFlowId(created.id);
    } catch {
      toast.error("Erro ao salvar fluxo importado");
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxos Automáticos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus fluxos de automação e chatbots</p>
        </div>
        <Button onClick={handleCreateFlow} disabled={createFlow.isPending} size="sm" variant="outline">
          <Plus className="h-4 w-4" /> Novo Fluxo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !flows?.length ? (
        <Card className="bg-card border-border rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-5">
              <Workflow className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium mb-1">Nenhum fluxo criado</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Crie seu primeiro fluxo de automação com o construtor visual.
            </p>
            <Button onClick={handleCreateFlow} size="sm" variant="outline">
              <Plus className="h-4 w-4" /> Criar Fluxo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {flows.map((flow) => (
            <Card
              key={flow.id}
              className="bg-card border-border rounded-xl overflow-hidden cursor-pointer group hover:shadow-md hover:shadow-primary/5 hover:border-primary/20 transition-all duration-200"
              onClick={() => setEditingFlowId(flow.id)}
            >
              <CardContent className="p-0">
                {/* Compact header */}
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    flow.active ? "bg-primary/10" : "bg-muted"
                  }`}>
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
                      variant="ghost"
                      size="sm"
                      className={`h-6 px-2 text-[10px] rounded-md font-medium ${
                        flow.active ? "text-destructive hover:bg-destructive/10" : "text-primary hover:bg-primary/10"
                      }`}
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
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteFlow.mutate(flow.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {/* Footer metadata */}
                <div className={`flex items-center gap-2.5 px-3.5 py-1.5 text-[10px] text-muted-foreground border-t ${flow.active ? "border-primary/10 bg-primary/[0.02]" : "border-border/50 bg-muted/20"}`}>
                  <span className="flex items-center gap-1"><Layers className="h-2.5 w-2.5" />{(flow.nodes as any[])?.length || 0}</span>
                  <span className="opacity-30">·</span>
                  <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(flow.updated_at).toLocaleDateString("pt-BR")}</span>
                  <span className="opacity-30">·</span>
                  <span className="flex items-center gap-1 truncate"><Radio className="h-2.5 w-2.5 shrink-0" />{(flow.instance_names as string[])?.length ? (flow.instance_names as string[]).join(", ") : "Todas"}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* New flow card */}
          <Card
            className="border-dashed border-border/50 rounded-xl hover:border-primary/20 transition-all duration-200 cursor-pointer flex items-center justify-center min-h-[82px] group"
            onClick={handleCreateFlow}
          >
            <CardContent className="flex items-center gap-2 p-3 text-muted-foreground">
              <Plus className="h-4 w-4 group-hover:text-primary transition-colors" />
              <span className="text-xs font-medium group-hover:text-foreground transition-colors">Novo Fluxo</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ChatbotBuilder;
