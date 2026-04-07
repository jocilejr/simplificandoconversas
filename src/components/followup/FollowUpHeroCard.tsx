import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Settings, Play, CheckCircle2, Clock, DollarSign, Send } from "lucide-react";

interface FollowUpHeroCardProps {
  totalToday: number;
  todayValue: number;
  sentToday: number;
  resolvedToday: number;
  pendingToday: number;
  onStartRecovery: () => void;
  onOpenSettings: () => void;
}

export function FollowUpHeroCard({
  totalToday, todayValue, sentToday, resolvedToday, pendingToday,
  onStartRecovery, onOpenSettings,
}: FollowUpHeroCardProps) {
  const progress = totalToday > 0 ? Math.min((resolvedToday / totalToday) * 100, 100) : 0;
  const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background border-primary/30">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <CardContent className="relative p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Recuperação de Hoje</h2>
                <p className="text-sm text-muted-foreground">
                  {pendingToday > 0
                    ? `${pendingToday} boleto${pendingToday > 1 ? "s" : ""} aguardando contato`
                    : totalToday > 0 ? "Todos os contatos realizados! 🎉" : "Nenhuma regra ativa para hoje"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
                <DollarSign className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Valor a recuperar</p>
                  <p className="font-semibold text-foreground">{formatCurrency(todayValue)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
                <Send className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                  <p className="font-semibold text-foreground">{sentToday}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Resolvidos</p>
                  <p className="font-semibold text-foreground">{resolvedToday} / {totalToday}</p>
                </div>
              </div>
            </div>

            {totalToday > 0 && (
              <div className="space-y-2 max-w-md">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso de hoje</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onStartRecovery} disabled={pendingToday === 0} size="lg" className="gap-2">
              <Play className="h-4 w-4" />
              Iniciar Recuperação
            </Button>
            <Button onClick={onOpenSettings} variant="outline" size="lg" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurar Régua
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
