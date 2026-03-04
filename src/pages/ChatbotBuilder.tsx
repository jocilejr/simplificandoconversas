import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Bot, Play, Square, MoreHorizontal, Trash2 } from "lucide-react";
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
          onBack={() => setEditingFlowId(null)}
          onSave={async (name, nodes, edges) => {
            await updateFlow.mutateAsync({ id: editingFlowId, name, nodes, edges });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chatbot Builder</h1>
          <p className="text-muted-foreground">
            Construa fluxos de automação visuais com drag & drop
          </p>
        </div>
        <Button onClick={handleCreateFlow} disabled={createFlow.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Novo Fluxo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !flows?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhum fluxo criado</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Crie seu primeiro fluxo de chatbot com o construtor visual.
            </p>
            <Button onClick={handleCreateFlow}>
              <Plus className="h-4 w-4 mr-1" /> Criar Primeiro Fluxo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <Card
              key={flow.id}
              className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => setEditingFlowId(flow.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        flow.active ? "bg-primary animate-pulse" : "bg-muted-foreground"
                      }`}
                    />
                    <h3 className="font-medium text-sm">{flow.name}</h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteFlow.mutate(flow.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{(flow.nodes as any[])?.length || 0} nós</span>
                  <span>{new Date(flow.updated_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant={flow.active ? "destructive" : "default"}
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateFlow.mutate({ id: flow.id, active: !flow.active });
                    }}
                  >
                    {flow.active ? (
                      <><Square className="h-3 w-3 mr-1" /> Parar</>
                    ) : (
                      <><Play className="h-3 w-3 mr-1" /> Ativar</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card
            className="bg-card border-border border-dashed hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-center min-h-[140px]"
            onClick={handleCreateFlow}
          >
            <CardContent className="flex flex-col items-center p-4 text-muted-foreground">
              <Plus className="h-8 w-8 mb-2" />
              <span className="text-sm">Novo Fluxo</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ChatbotBuilder;
