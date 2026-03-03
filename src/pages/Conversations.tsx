import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

const Conversations = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversas</h1>
        <p className="text-muted-foreground">Visualize e gerencie conversas em tempo real</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[calc(100vh-12rem)]">
        <Card className="bg-card border-border rounded-r-none lg:border-r-0">
          <div className="p-4 border-b border-border">
            <input
              placeholder="Buscar conversas..."
              className="w-full px-3 py-2 bg-secondary rounded-lg text-sm placeholder:text-muted-foreground outline-none"
            />
          </div>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2" />
              <span className="text-sm">Nenhuma conversa</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-card border-border rounded-l-none flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3" />
            <p className="text-sm">Selecione uma conversa para visualizar</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Conversations;
