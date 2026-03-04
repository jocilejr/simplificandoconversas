import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw } from "lucide-react";
import { useFlowHistory, type FlowHistoryEntry } from "@/hooks/useFlowHistory";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FlowHistoryPanelProps {
  flowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (entry: FlowHistoryEntry) => void;
}

export function FlowHistoryPanel({ flowId, open, onOpenChange, onRestore }: FlowHistoryPanelProps) {
  const { data: history, isLoading } = useFlowHistory(flowId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Histórico</SheetTitle>
          <SheetDescription>Versões anteriores do fluxo</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !history?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum histórico ainda</p>
          ) : (
            <div className="space-y-2 pr-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{entry.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(entry.nodes as any[])?.length || 0} nós
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      onRestore(entry);
                      onOpenChange(false);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
