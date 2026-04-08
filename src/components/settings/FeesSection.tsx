import { useState, useEffect } from "react";
import { useFinancialSettings } from "@/hooks/useFinancialSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCode, FileText, CreditCard, Receipt } from "lucide-react";

interface FeeBlock {
  type: "fixed" | "percent";
  value: number;
}

export function FeesSection() {
  const { settings, isLoading, save, isSaving } = useFinancialSettings();

  const [boleto, setBoleto] = useState<FeeBlock>({ type: "fixed", value: 0 });
  const [pix, setPix] = useState<FeeBlock>({ type: "fixed", value: 0 });
  const [cartao, setCartao] = useState<FeeBlock>({ type: "percent", value: 0 });
  const [tax, setTax] = useState<FeeBlock>({ type: "percent", value: 0 });
  const [taxName, setTaxName] = useState("Imposto");

  useEffect(() => {
    if (settings) {
      setBoleto({ type: settings.boleto_fee_type, value: settings.boleto_fee_value });
      setPix({ type: settings.pix_fee_type, value: settings.pix_fee_value });
      setCartao({ type: settings.cartao_fee_type, value: settings.cartao_fee_value });
      setTax({ type: settings.tax_type, value: settings.tax_value });
      setTaxName(settings.tax_name);
    }
  }, [settings]);

  const handleSave = () => {
    save({
      boleto_fee_type: boleto.type,
      boleto_fee_value: boleto.value,
      pix_fee_type: pix.type,
      pix_fee_value: pix.value,
      cartao_fee_type: cartao.type,
      cartao_fee_value: cartao.value,
      tax_type: tax.type,
      tax_value: tax.value,
      tax_name: taxName,
    });
  };

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Taxas e Impostos</h2>
        <p className="text-sm text-muted-foreground">Configure as taxas por método de pagamento e impostos do workspace</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FeeCard icon={FileText} title="Boleto" fee={boleto} onChange={setBoleto} />
        <FeeCard icon={QrCode} title="PIX" fee={pix} onChange={setPix} />
        <FeeCard icon={CreditCard} title="Cartão" fee={cartao} onChange={setCartao} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Receipt className="h-4 w-4" />
              {taxName || "Imposto"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome do imposto</Label>
              <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="Ex: Simples Nacional" className="mt-1 h-8 text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{tax.type === "fixed" ? "Valor fixo (R$)" : "Percentual (%)"}</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">R$</span>
                <Switch checked={tax.type === "percent"} onCheckedChange={(c) => setTax(prev => ({ ...prev, type: c ? "percent" : "fixed" }))} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <Input type="number" min={0} step={tax.type === "percent" ? 0.1 : 0.01} value={tax.value} onChange={(e) => setTax(prev => ({ ...prev, value: Number(e.target.value) }))} className="h-8 text-sm" />
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
        {isSaving ? "Salvando..." : "Salvar Taxas"}
      </Button>
    </div>
  );
}

function FeeCard({ icon: Icon, title, fee, onChange }: { icon: any; title: string; fee: { type: "fixed" | "percent"; value: number }; onChange: (f: { type: "fixed" | "percent"; value: number }) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">{fee.type === "fixed" ? "Valor fixo (R$)" : "Percentual (%)"}</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">R$</span>
            <Switch checked={fee.type === "percent"} onCheckedChange={(c) => onChange({ ...fee, type: c ? "percent" : "fixed" })} />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <Input type="number" min={0} step={fee.type === "percent" ? 0.1 : 0.01} value={fee.value} onChange={(e) => onChange({ ...fee, value: Number(e.target.value) })} className="h-8 text-sm" />
      </CardContent>
    </Card>
  );
}
