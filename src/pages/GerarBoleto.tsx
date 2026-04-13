import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2 } from "lucide-react";
import { useCreatePayment, type PaymentResult as PaymentResultType } from "@/hooks/useCreatePayment";
import { PaymentResult } from "@/components/transactions/PaymentResult";

const maskCPF = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 2) return d;
  // Com código de país (55...) — formato: +55 (DD) XXXXX-XXXX
  if (d.length >= 12 && d.startsWith("55")) {
    const cc = d.slice(0, 2);
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length <= 4) return `+${cc} (${ddd}) ${rest}`;
    if (rest.length <= 8) return `+${cc} (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `+${cc} (${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  // Sem código de país — formato: (DD) XXXXX-XXXX
  if (d.length <= 6) return d.replace(/(\d{2})(\d)/, "($1) $2");
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

const maskCurrency = (v: string) => {
  const num = v.replace(/\D/g, "");
  const val = (parseInt(num || "0") / 100).toFixed(2);
  return val.replace(".", ",");
};

const parseCurrency = (v: string) => {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
};

const GerarBoleto = () => {
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_document: "",
    amount: "",
    description: "",
  });

  const [result, setResult] = useState<PaymentResultType | null>(null);
  const createPayment = useCreatePayment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrency(form.amount);
    if (amount <= 0) return;

    const data = await createPayment.mutateAsync({
      customer_name: form.customer_name,
      customer_phone: form.customer_phone.replace(/\D/g, ""),
      customer_document: form.customer_document.replace(/\D/g, "") || undefined,
      amount,
      description: form.description || undefined,
      type: "boleto",
    });

    setResult(data);
  };

  const resetForm = () => {
    setResult(null);
    setForm({
      customer_name: "",
      customer_phone: "",
      customer_document: "",
      amount: "",
      description: "",
    });
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto py-6 px-4">
        <PaymentResult result={result} onNewPayment={resetForm} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Gerar Boleto</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                required
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={form.customer_document}
                onChange={(e) => setForm({ ...form, customer_document: maskCPF(e.target.value) })}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: maskPhone(e.target.value) })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: maskCurrency(e.target.value) })}
                placeholder="0,00"
                className="font-mono text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição da cobrança (opcional)"
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full" disabled={createPayment.isPending}>
              {createPayment.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...
                </>
              ) : (
                "Gerar Boleto"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default GerarBoleto;
