import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Bot, Play, Square, MoreHorizontal } from "lucide-react";
import { FlowEditor } from "@/components/chatbot/FlowEditor";

interface Flow {
  id: string;
  name: string;
  active: boolean;
  nodesCount: number;
  updatedAt: string;
}

const ChatbotBuilder = () => {
  const [editingFlow, setEditingFlow] = useState<string | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [newFlowName, setNewFlowName] = useState("");

  const handleCreateFlow = () => {
    const id = `flow_${Date.now()}`;
    setFlows((prev) => [
      ...prev,
      {
        id,
        name: `Novo Fluxo ${prev.length + 1}`,
        active: false,
        nodesCount: 0,
        updatedAt: new Date().toLocaleDateString("pt-BR"),
      },
    ]);
    setEditingFlow(id);
  };

  if (editingFlow) {
    const flow = flows.find((f) => f.id === editingFlow);
    return (
      <div className="h-[calc(100vh-5rem)] -m-6">
        <FlowEditor
          flowName={flow?.name || "Novo Fluxo"}
          onBack={() => setEditingFlow(null)}
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
        <Button onClick={handleCreateFlow}>
          <Plus className="h-4 w-4 mr-1" /> Novo Fluxo
        </Button>
      </div>

      {flows.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhum fluxo criado</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Crie seu primeiro fluxo de chatbot com o construtor visual. Arraste e solte nós
              para criar respostas automáticas, condições, delays e muito mais.
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
              onClick={() => setEditingFlow(flow.id)}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{flow.nodesCount} nós</span>
                  <span>Atualizado: {flow.updatedAt}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant={flow.active ? "destructive" : "default"}
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlows((prev) =>
                        prev.map((f) =>
                          f.id === flow.id ? { ...f, active: !f.active } : f
                        )
                      );
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

          {/* Add card */}
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
