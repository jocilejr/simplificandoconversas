import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Copy, Link2, Search, UserCheck, UserPlus, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/normalizePhone";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: any;
  workspaceId: string | null;
  userId: string | undefined;
}

type Step =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "found"; name: string | null }
  | { status: "created" }
  | { status: "granting" }
  | { status: "done"; link: string; message: string };

function StepCard({ icon: Icon, label, active, variant }: { icon: any; label: string; active?: boolean; variant?: "success" | "warning" | "info" }) {
  const colors = {
    success: "border-green-500/30 bg-green-500/5 text-green-400",
    warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
    info: "border-primary/30 bg-primary/5 text-primary",
  };
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${colors[variant || "info"]}`}>
      {active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function LinkGenerator({ open, onOpenChange, product, workspaceId, userId }: Props) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [step, setStep] = useState<Step>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["delivery-settings", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_settings")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return data;
    },
  });

  const runProcess = useCallback(async () => {
    if (!workspaceId || !userId) throw new Error("Sem workspace");
    const normalized = normalizePhone(phone);
    if (normalized === "-" || normalized.length < 10) {
      toast.error("Telefone inválido");
      return;
    }

    // Step 1: Search lead
    setStep({ status: "searching" });
    await new Promise((r) => setTimeout(r, 600));

    let matchedName: string | null = null;

    if (paymentMethod === "pix") {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id, phone_number, contact_name")
        .eq("workspace_id", workspaceId);

      const last8 = normalized.slice(-8);

      let matched = convos?.find((c) => normalizePhone(c.phone_number) === normalized);
      if (!matched) {
        matched = convos?.find((c) => {
          const norm = normalizePhone(c.phone_number);
          return norm !== "-" && norm.slice(-8) === last8;
        });
      }

      if (matched) {
        matchedName = matched.contact_name || null;
        setStep({ status: "found", name: matchedName });
      } else {
        // Create new contact
        const { data: newConvo } = await supabase
          .from("conversations")
          .insert({
            user_id: userId,
            workspace_id: workspaceId,
            remote_jid: normalized,
            phone_number: normalized,
          })
          .select("id, phone_number, contact_name")
          .single();
        matched = newConvo;
        setStep({ status: "created" });
      }

      await new Promise((r) => setTimeout(r, 800));

      // Step 2: Grant access + transaction
      setStep({ status: "granting" });

      await supabase.from("member_products").upsert(
        {
          workspace_id: workspaceId,
          product_id: product.id,
          phone: normalized,
          is_active: true,
        },
        { onConflict: "product_id,phone" }
      );

      await supabase.from("delivery_link_generations").insert({
        workspace_id: workspaceId,
        product_id: product.id,
        phone,
        normalized_phone: normalized,
        payment_method: paymentMethod,
      });

      await supabase.from("transactions").insert({
        user_id: userId,
        workspace_id: workspaceId,
        type: "pix",
        status: "aprovado",
        amount: product.value,
        customer_phone: normalized,
        source: "entrega_digital",
        description: product.name,
        paid_at: new Date().toISOString(),
      });
    } else {
      // Boleto/Cartão — no lead matching, just grant access
      setStep({ status: "found", name: null });
      await new Promise((r) => setTimeout(r, 500));

      setStep({ status: "granting" });

      await supabase.from("member_products").upsert(
        {
          workspace_id: workspaceId,
          product_id: product.id,
          phone: normalized,
          is_active: true,
        },
        { onConflict: "product_id,phone" }
      );

      await supabase.from("delivery_link_generations").insert({
        workspace_id: workspaceId,
        product_id: product.id,
        phone,
        normalized_phone: normalized,
        payment_method: paymentMethod,
      });
    }

    await new Promise((r) => setTimeout(r, 600));

    // Step 3: Build link + message
    const domain = (settings as any)?.custom_domain || window.location.origin;
    const link = `${domain.replace(/\/$/, "")}/${normalized}`;
    const deliveryMsg = (settings as any)?.delivery_message;
    const finalMessage = deliveryMsg ? `${deliveryMsg}\n\n${link}` : link;

    setStep({ status: "done", link, message: finalMessage });

    qc.invalidateQueries({ queryKey: ["delivery-link-generations"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });

    toast.success(
      paymentMethod === "pix"
        ? "Acesso liberado + pagamento PIX vinculado ao lead!"
        : "Acesso liberado e link gerado!"
    );
  }, [workspaceId, userId, phone, paymentMethod, product, settings, qc]);

  const handleCopy = () => {
    if (step.status !== "done") return;
    navigator.clipboard.writeText(step.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Mensagem copiada!");
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setPhone("");
      setStep({ status: "idle" });
      setCopied(false);
    }
    onOpenChange(o);
  };

  const isProcessing = step.status !== "idle" && step.status !== "done";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Gerar Link — {product.name}
          </DialogTitle>
        </DialogHeader>

        {step.status === "idle" ? (
          <div className="space-y-4">
            <div>
              <Label>Telefone do Cliente</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11999999999"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O acesso será liberado automaticamente na Área de Membros
              </p>
            </div>
            <div>
              <Label>Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                </SelectContent>
              </Select>
              {paymentMethod === "pix" && (
                <p className="text-xs text-muted-foreground mt-1">
                  PIX: será criada uma transação aprovada e vinculada ao lead
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={runProcess}
              disabled={!phone.trim()}
            >
              Liberar Acesso e Gerar Link
            </Button>
          </div>
        ) : step.status === "done" ? (
          <div className="space-y-3">
            <StepCard icon={Search} label="Lead buscado" variant="success" />
            <StepCard icon={ShieldCheck} label="Acesso liberado" variant="success" />

            <div className="p-3 bg-muted rounded-md mt-2">
              <p className="text-sm font-mono break-all whitespace-pre-wrap">{step.message}</p>
            </div>
            <Button className="w-full" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Copiado!" : "Copiar Mensagem"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { setStep({ status: "idle" }); setPhone(""); }}>
              Gerar outro link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {step.status === "searching" && (
              <StepCard icon={Search} label="Buscando lead..." active variant="info" />
            )}

            {(step.status === "found" || step.status === "created" || step.status === "granting") && (
              <>
                <StepCard icon={Search} label="Lead buscado" variant="success" />
                {step.status === "found" || (step.status === "granting" && true) ? null : null}
              </>
            )}

            {step.status === "found" && (
              <>
                <StepCard icon={UserCheck} label="Lead encontrado no banco de dados" variant="success" />
                {step.name && <StepCard icon={UserCheck} label={`Nome: ${step.name}`} variant="info" />}
              </>
            )}

            {step.status === "created" && (
              <StepCard icon={UserPlus} label="Novo lead criado" variant="warning" />
            )}

            {step.status === "granting" && (
              <>
                <StepCard icon={UserCheck} label="Lead processado" variant="success" />
                <StepCard icon={ShieldCheck} label="Liberando acesso..." active variant="info" />
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
