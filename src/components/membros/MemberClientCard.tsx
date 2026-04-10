import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generatePhoneVariations } from "@/lib/phoneNormalization";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, Copy, Plus, ChevronRight, Link, ShoppingBag, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import { normalizePhone } from "@/lib/normalizePhone";

interface MemberProduct {
  id: string;
  phone: string;
  is_active: boolean;
  delivery_products: { name: string } | null;
}

interface Props {
  phone: string;
  products: MemberProduct[];
  customerName: string | null;
  onDeleteProduct: (id: string) => void;
  onAddProduct: (phone: string) => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pago: { label: "Pago", variant: "default" },
  gerado: { label: "Gerado", variant: "outline" },
  pendente: { label: "Pendente", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "destructive" },
};

export default function MemberClientCard({ phone, products, customerName, onDeleteProduct, onAddProduct }: Props) {
  const { workspaceId } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: deliverySettings } = useQuery({
    queryKey: ["delivery-settings", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_settings")
        .select("custom_domain")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return data;
    },
  });

  const getMemberDomain = () => {
    let domain = (deliverySettings as any)?.custom_domain || "";
    if (!domain) return "";
    if (!domain.startsWith("http")) domain = `https://${domain}`;
    return domain;
  };

  const memberDomain = getMemberDomain();
  const memberUrl = memberDomain ? `${memberDomain.replace(/\/$/, "")}/${normalizePhone(phone)}` : "";

  const copyLink = () => {
    if (!memberUrl) {
      toast.error("Configure o domínio da Área de Membros nas configurações");
      return;
    }
    navigator.clipboard.writeText(memberUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["member-transactions", phone, workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const variations = generatePhoneVariations(phone);
      if (!variations.length) return [];
      const { data } = await supabase
        .from("transactions" as any)
        .select("id, description, amount, status, type, created_at, paid_at")
        .eq("workspace_id", workspaceId)
        .in("customer_phone", variations)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: expanded && !!workspaceId,
  });

  const hasActiveProduct = products.some((p) => p.is_active);
  const initials = customerName ? customerName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "?";

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{customerName || "Cliente sem nome"}</p>
          <p className="text-xs font-mono text-muted-foreground">{phone}</p>
        </div>
        <Badge variant={hasActiveProduct ? "default" : "secondary"} className="text-[10px] h-5 shrink-0">
          {hasActiveProduct ? "Ativo" : "Inativo"}
        </Badge>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border">
          <div className="flex items-center gap-2 pt-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Link className="h-3.5 w-3.5" /> Copiar link
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <p className="text-xs text-muted-foreground mb-2">Link de acesso do membro</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 truncate border border-border font-mono text-foreground">
                    {memberUrl}
                  </code>
                  <Button size="sm" className="shrink-0 h-8 px-3" onClick={copyLink}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => onAddProduct(phone)}>
              <Plus className="h-3.5 w-3.5" /> Liberar produto
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Produtos liberados</p>
            <div className="flex flex-wrap gap-2">
              {products.map((mp) => (
                <div key={mp.id} className="flex items-center gap-1.5 bg-muted border border-border rounded-md px-3 py-1.5">
                  <span className="text-xs text-foreground">{mp.delivery_products?.name || "Removido"}</span>
                  <button className="text-muted-foreground hover:text-destructive transition-colors ml-1" onClick={() => onDeleteProduct(mp.id)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {!products.length && <p className="text-xs text-muted-foreground italic">Nenhum produto liberado</p>}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" /> Histórico de Compras
            </p>
            {loadingTx ? (
              <p className="text-xs text-muted-foreground text-center py-3">Carregando...</p>
            ) : !transactions?.length ? (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma transação encontrada</p>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((tx: any) => {
                  const st = statusMap[tx.status] || { label: tx.status, variant: "outline" as const };
                  const date = tx.paid_at || tx.created_at;
                  return (
                    <div key={tx.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-3 py-2 border border-border/50">
                      <span className="truncate flex-1 mr-2 text-foreground">{tx.description || "Sem descrição"}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-foreground">R$ {Number(tx.amount).toFixed(2).replace(".", ",")}</span>
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                        <span className="text-muted-foreground">{format(new Date(date), "dd/MM", { locale: ptBR })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
