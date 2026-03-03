import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Bot } from "lucide-react";

const ChatbotBuilder = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chatbot Builder</h1>
          <p className="text-muted-foreground">Construa fluxos de automação visuais</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Fluxo
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum fluxo criado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crie seu primeiro fluxo de chatbot com o construtor visual drag & drop
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-1" /> Criar Primeiro Fluxo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatbotBuilder;
