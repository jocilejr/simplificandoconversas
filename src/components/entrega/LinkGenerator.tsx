import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/normalizePhone";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: any;
  workspaceId: string | null;
  userId: string | undefined;
}

export function LinkGenerator({ open, onOpenChange, product, workspaceId, userId }: Props) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["delivery-settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_settings")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return data;
    },
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !userId) throw new Error("Sem workspace");
      const normalized = normalizePhone(phone);
      if (normalized === "-" || normalized.length < 10) throw new Error("Telefone inválido");

      // 1. Always: grant access in member area
      await supabase.from("member_products").upsert({
        workspace_id: workspaceId,
        product_id: product.id,
        normalized_phone: normalized,
        is_active: true,
      }, { onConflict: "workspace_id,product_id,normalized_phone" });

      // 2. Always: log link generation
      await supabase.from("delivery_link_generations").insert({
        workspace_id: workspaceId,
        product_id: product.id,
        phone,
        normalized_phone: normalized,
        payment_method: paymentMethod,
      });

      // 3. PIX only: match/create lead + insert transaction
      if (paymentMethod === "pix") {
        const last8 = normalized.slice(-8);

        // Fetch all conversations for this workspace
        const { data: convos } = await supabase
          .from("conversations")
          .select("id, phone_number")
          .eq("workspace_id", workspaceId);

        // Priority 1: exact match on full normalized phone
        let matched = convos?.find(c => normalizePhone(c.phone_number) === normalized);

        // Fallback: match by last 8 digits
        if (!matched) {
          matched = convos?.find(c => {
            const norm = normalizePhone(c.phone_number);
            return norm !== "-" && norm.slice(-8) === last8;
          });
        }

        // No match: create new contact (remote_jid = just the number, NO suffixes)
        if (!matched) {
          const { data: newConvo } = await supabase
            .from("conversations")
            .insert({
              user_id: userId,
              workspace_id: workspaceId,
              remote_jid: normalized,
              phone_number: normalized,
            })
            .select("id")
            .single();
          matched = newConvo;
        }

        // Insert approved PIX transaction
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
      }

      // 4. Build link
      const domain = settings?.custom_domain || window.location.origin;
      const link = `${domain}/entrega/${product.slug}?phone=${encodeURIComponent(normalized)}`;
      return link;
    },
    onSuccess: (link) => {
      setGeneratedLink(link);
      qc.invalidateQueries({ queryKey: ["delivery-link-generations"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(
        paymentMethod === "pix"
          ? "Acesso liberado + pagamento PIX vinculado ao lead!"
          : "Acesso liberado e link gerado!"
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCopy = () => {
    if (!generatedLink) return;
    const template = settings?.link_message_template || "Olá! Aqui está seu acesso: {link}";
    const msg = template.replace("{link}", generatedLink);
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Mensagem copiada!");
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setPhone("");
      setGeneratedLink(null);
      setCopied(false);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Gerar Link — {product.name}
          </DialogTitle>
        </DialogHeader>

        {!generatedLink ? (
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
              onClick={() => generateMut.mutate()}
              disabled={!phone.trim() || generateMut.isPending}
            >
              {generateMut.isPending ? "Gerando..." : "Liberar Acesso e Gerar Link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-mono break-all">{generatedLink}</p>
            </div>
            <Button className="w-full" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Copiado!" : "Copiar Mensagem com Link"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { setGeneratedLink(null); setPhone(""); }}>
              Gerar outro link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
