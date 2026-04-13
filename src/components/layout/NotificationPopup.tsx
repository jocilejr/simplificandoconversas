import { Bell, X, CreditCard, FileText, QrCode, ShoppingCart, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import type { TransactionNotification } from "@/hooks/useTransactionNotifications";
import { cn } from "@/lib/utils";

interface NotificationPopupProps {
  notifications: TransactionNotification[];
  onDismissAll: () => void;
  onDismissOne: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getTypeIcon(type: string) {
  switch (type) {
    case "boleto": return <FileText className="h-4 w-4" />;
    case "pix": return <QrCode className="h-4 w-4" />;
    case "cartao":
    case "card": return <CreditCard className="h-4 w-4" />;
    case "yampi_cart": return <ShoppingCart className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "aprovado": return "text-green-500";
    case "pendente": return "text-yellow-500";
    case "rejeitado": return "text-destructive";
    case "abandonado": return "text-orange-500";
    default: return "text-muted-foreground";
  }
}

function getStatusLabel(type: string, status: string): string {
  if (type === "boleto" && status === "pendente") return "Boleto gerado";
  if (type === "boleto" && status === "aprovado") return "Boleto pago";
  if (type === "pix" && status === "pendente") return "PIX gerado";
  if (type === "pix" && status === "aprovado") return "PIX recebido";
  if ((type === "cartao" || type === "card") && status === "aprovado") return "Cartão aprovado";
  if ((type === "cartao" || type === "card") && status === "rejeitado") return "Cartão recusado";
  if (type === "yampi_cart" && status === "abandonado") return "Carrinho abandonado";
  return `${type} - ${status}`;
}

export function NotificationPopup({ notifications, onDismissAll, onDismissOne }: NotificationPopupProps) {
  const navigate = useNavigate();
  const count = notifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] animate-pulse">
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold">Notificações</h4>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onDismissAll}>
              Limpar tudo
            </Button>
          )}
        </div>

        {count === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            Nenhuma notificação recente
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                  <div className={cn("mt-0.5", getStatusColor(n.status))}>
                    {getTypeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.customerName}</p>
                    <p className={cn("text-xs", getStatusColor(n.status))}>
                      {getStatusLabel(n.type, n.status)}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-semibold">{formatCurrency(n.amount)}</span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(n.timestamp)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 mt-0.5"
                    onClick={() => onDismissOne(n.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="border-t border-border px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1"
            onClick={() => navigate("/transacoes")}
          >
            <ExternalLink className="h-3 w-3" />
            Ver todas as transações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
