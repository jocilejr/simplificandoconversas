import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { PaymentResult as PaymentResultType } from "@/hooks/useCreatePayment";

interface PaymentResultProps {
  result: PaymentResultType;
  onNewPayment: () => void;
}

export function PaymentResult({ result, onNewPayment }: PaymentResultProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <CardTitle className="text-lg">Cobrança Criada!</CardTitle>
          <Badge variant="outline">{result.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.payment_url && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Link de Pagamento</label>
            <div className="flex gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                {result.payment_url}
              </code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.payment_url, "Link")}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={result.payment_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {result.barcode && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Código de Barras / Linha Digitável</label>
            <div className="flex gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                {result.barcode}
              </code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.barcode, "Código")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {result.qr_code && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Código PIX (Copia e Cola)</label>
            <div className="flex gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all max-h-20 overflow-auto">
                {result.qr_code}
              </code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.qr_code, "PIX")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {result.qr_code_base64 && (
          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${result.qr_code_base64}`}
              alt="QR Code PIX"
              className="w-48 h-48 rounded-lg border"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={onNewPayment} className="flex-1">
            Nova Cobrança
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
