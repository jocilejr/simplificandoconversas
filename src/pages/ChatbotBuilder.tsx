import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Play, Square, MoreHorizontal, Trash2, Workflow, Calendar, Layers } from "lucide-react";
import { FlowEditor } from "@/components/chatbot/FlowEditor";
import { useChatbotFlows } from "@/hooks/useChatbotFlows";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ChatbotBuilder = () => {
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const { data: flows, isLoading, createFlow, updateFlow, deleteFlow } = useChatbotFlows();

  const handleCreateFlow = async () => {
    try {
      const result = await createFlow.mutateAsync(`Novo Fluxo ${(flows?.length || 0) + 1}`);
      setEditingFlowId(result.id);
    } catch {
      toast.error("Erro ao criar fluxo");
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
          onBack={() => setEditingFlowId(null)}
          onSave={async (name, nodes, edges, instanceNames) => {
            await updateFlow.mutateAsync({ id: editingFlowId, name, nodes, edges, instance_names: instanceNames });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Fluxos Automáticos</h1>
        <Button onClick={handleCreateFlow} disabled={createFlow.isPending} size="sm">
          <Plus className="h-4 w-4" /> Novo Fluxo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !flows?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-5">
              <Workflow className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium mb-1">Nenhum fluxo criado</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Crie seu primeiro fluxo de automação com o construtor visual.
            </p>
            <Button onClick={handleCreateFlow} size="sm">
              <Plus className="h-4 w-4" /> Criar Fluxo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {flows.map((flow) => (
            <Card
              key={flow.id}
              className="bg-card border-border overflow-hidden cursor-pointer group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              onClick={() => setEditingFlowId(flow.id)}
            >
              {/* Top accent bar */}
              <div className={`h-1 w-full ${flow.active ? "bg-primary" : "bg-muted"}`} />

              <CardContent className="p-6 flex flex-col gap-5">
                {/* Icon + Name + Menu */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      flow.active ? "bg-primary/10" : "bg-muted"
                    }`}>
                      <Workflow className={`h-4 w-4 ${flow.active ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm truncate">{flow.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${flow.active ? "bg-primary" : "bg-muted-foreground/40"}`} />
                        <span className="text-[11px] text-muted-foreground">
                          {flow.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteFlow.mutate(flow.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    {(flow.nodes as any[])?.length || 0} nós
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(flow.updated_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                {/* Toggle action */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 text-xs w-full border transition-colors ${
                    flow.active
                      ? "border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      : "border-border text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateFlow.mutate({ id: flow.id, active: !flow.active });
                  }}
                >
                  {flow.active ? (
                    <><Square className="h-3 w-3" /> Parar</>
                  ) : (
                    <><Play className="h-3 w-3" /> Ativar</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* New flow card */}
          <Card
            className="border-dashed border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer flex items-center justify-center min-h-[220px] group"
            onClick={handleCreateFlow}
          >
            <CardContent className="flex flex-col items-center gap-3 p-6 text-muted-foreground">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300">
                <Plus className="h-5 w-5 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-xs font-medium group-hover:text-foreground transition-colors">Novo Fluxo</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ChatbotBuilder;
