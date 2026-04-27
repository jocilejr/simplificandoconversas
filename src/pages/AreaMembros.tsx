import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadMediaFile } from "@/lib/uploadMedia";
import { useWorkspace } from "@/hooks/useWorkspace";
import { normalizePhone } from "@/lib/normalizePhone";
import { toast } from "sonner";
import { Crown, Plus, Search, Gift, Users, BookOpen, Edit, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import MemberClientCard from "@/components/membros/MemberClientCard";
import ContentManagement from "@/components/membros/ContentManagement";
import MemberActivityTab from "@/components/membros/MemberActivityTab";

// ---- Member Products Tab ----
function MemberProductsTab() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [searchPhone, setSearchPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["delivery-products-names", workspaceId],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products" as any).select("id, name, value").eq("workspace_id", workspaceId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!workspaceId,
  });

  const { data: memberProducts, isLoading } = useQuery({
    queryKey: ["member-products", searchPhone, workspaceId],
    queryFn: async () => {
      // Step 1: fetch member_products WITHOUT embedded join
      let query = supabase
        .from("member_products" as any)
        .select("id, phone, is_active, product_id, workspace_id, created_at")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });

      if (searchPhone.trim()) {
        const digits = searchPhone.replace(/\D/g, "");
        query = query.ilike("phone", `%${digits}%`);
      }

      const allData: any[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) { allData.push(...data); from += pageSize; hasMore = data.length === pageSize; }
        else hasMore = false;
      }

      // Step 2: fetch product names separately
      const productIds = Array.from(new Set(allData.map((mp: any) => mp.product_id).filter(Boolean)));
      const productMap: Record<string, string> = {};
      if (productIds.length) {
        const { data: prods } = await supabase
          .from("delivery_products" as any)
          .select("id, name")
          .in("id", productIds);
        for (const p of (prods || []) as any[]) productMap[p.id] = p.name;
      }

      // Step 3: merge
      return allData.map((mp: any) => ({
        ...mp,
        delivery_products: mp.product_id && productMap[mp.product_id]
          ? { name: productMap[mp.product_id] }
          : null,
      }));
    },
    enabled: !!workspaceId,
  });

  const uniquePhones = useMemo(() => {
    if (!memberProducts) return [];
    return Array.from(new Set(memberProducts.map((mp: any) => mp.phone)));
  }, [memberProducts]);

  // Get names from conversations
  const { data: phoneNames } = useQuery({
    queryKey: ["member-phone-names", uniquePhones, workspaceId],
    queryFn: async () => {
      if (!uniquePhones.length || !workspaceId) return {};
      const { data } = await supabase
        .from("conversations")
        .select("phone_number, contact_name")
        .eq("workspace_id", workspaceId)
        .not("contact_name", "is", null);
      if (!data) return {};
      const map: Record<string, string> = {};
      for (const phone of uniquePhones) {
        const last8 = phone.replace(/\D/g, "").slice(-8);
        const match = data.find((c: any) => c.phone_number && c.phone_number.replace(/\D/g, "").slice(-8) === last8);
        if (match?.contact_name) map[phone] = match.contact_name;
      }
      return map;
    },
    enabled: uniquePhones.length > 0 && !!workspaceId,
  });

  const groupedByPhone = useMemo(() => {
    if (!memberProducts) return [];
    const map = new Map<string, { phone: string; items: any[] }>();
    for (const mp of memberProducts) {
      const last8 = mp.phone.slice(-8);
      if (!map.has(last8)) map.set(last8, { phone: mp.phone, items: [] });
      map.get(last8)!.items.push(mp);
    }
    return Array.from(map.values()).map(({ phone, items }) => ({ phone, products: items }));
  }, [memberProducts]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Workspace não encontrado");
      if (!newProductId) throw new Error("Selecione um produto");

      const normalizedPhone = normalizePhone(newPhone);
      if (normalizedPhone === "-" || normalizedPhone.length < 10) {
        throw new Error("Telefone inválido");
      }

      const selectedProduct = products?.find((p: any) => p.id === newProductId);

      const { error } = await supabase.from("member_products" as any).upsert(
        {
          workspace_id: workspaceId,
          phone: normalizedPhone,
          product_id: newProductId,
          title: selectedProduct?.name || '',
          is_active: true,
        } as any,
        { onConflict: "product_id,phone" }
      );

      if (error) throw error;

      // Create pixel frame so the member fires the pixel on next page access
      const { error: pixelErr } = await supabase.from("member_pixel_frames" as any).insert({
        workspace_id: workspaceId,
        normalized_phone: normalizedPhone,
        product_name: selectedProduct?.name || '',
        product_value: selectedProduct?.value || 0,
      } as any);
      if (pixelErr) console.error("[AreaMembros] pixel_frame insert error:", pixelErr);
    },
    onSuccess: () => { toast.success("Produto liberado!"); queryClient.invalidateQueries({ queryKey: ["member-products"] }); setNewPhone(""); setNewProductId(""); setDialogOpen(false); },
    onError: (err: any) => { console.error("[AreaMembros] addMutation error:", JSON.stringify(err)); toast.error(err.message || "Erro ao liberar produto"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("member_products" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Acesso removido"); queryClient.invalidateQueries({ queryKey: ["member-products"] }); },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por telefone..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Liberar Produto</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Liberar Produto para Membro</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Telefone do cliente</Label><Input placeholder="Ex: 89981340810" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
              <div>
                <Label>Produto</Label>
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>{products?.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>{addMutation.isPending ? "Liberando..." : "Liberar Acesso"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="px-4 py-3"><p className="text-2xl font-semibold text-primary">{groupedByPhone.length}</p><p className="text-xs text-muted-foreground">Membros</p></Card>
        <Card className="px-4 py-3"><p className="text-2xl font-semibold text-foreground">{memberProducts?.filter((p: any) => p.is_active).length || 0}</p><p className="text-xs text-muted-foreground">Acessos Ativos</p></Card>
        <Card className="px-4 py-3 hidden sm:block"><p className="text-2xl font-semibold text-foreground">{memberProducts?.length || 0}</p><p className="text-xs text-muted-foreground">Total Liberados</p></Card>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : !groupedByPhone.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum produto liberado ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByPhone.map(({ phone, products: prods }) => (
            <MemberClientCard key={phone} phone={phone} products={prods} customerName={phoneNames?.[phone] || null} onDeleteProduct={(id) => deleteMutation.mutate(id)} onAddProduct={(p) => { setNewPhone(p); setDialogOpen(true); }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Offers Tab ----
function MemberOffersTab() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryTag, setCategoryTag] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [displayType, setDisplayType] = useState("card");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("telefone");
  const [cardPaymentUrl, setCardPaymentUrl] = useState("");

  const { data: products } = useQuery({
    queryKey: ["delivery-products-for-offers", workspaceId],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products" as any).select("id, name, page_logo, value").eq("workspace_id", workspaceId!).eq("is_active", true);
      return (data || []) as any[];
    },
    enabled: !!workspaceId,
  });

  const { data: offers, isLoading } = useQuery({
    queryKey: ["member-area-offers", workspaceId],
    queryFn: async () => {
      const { data } = await supabase.from("member_area_offers" as any).select("*").eq("workspace_id", workspaceId!).order("sort_order");
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Conversions: count payment_started per offer_id
  const { data: offerConversions } = useQuery({
    queryKey: ["offer-conversions", workspaceId],
    queryFn: async () => {
      const { data } = await supabase.from("member_offer_impressions" as any).select("offer_id").eq("payment_started", true);
      if (!data) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data as any[]) {
        counts[row.offer_id] = (counts[row.offer_id] || 0) + 1;
      }
      return counts;
    },
    enabled: !!workspaceId,
  });

  const uploadImage = async (file: File): Promise<string> => {
    return uploadMediaFile(file);
  };

  const resetForm = () => {
    setSelectedProductId(""); setDescription(""); setPrice(""); setCategoryTag(""); setImageFile(null); setEditingOffer(null); setUploading(false); setDisplayType("card"); setPixKey(""); setPixKeyType("telefone"); setCardPaymentUrl("");
  };

  const openEdit = (offer: any) => {
    setEditingOffer(offer); setSelectedProductId(offer.product_id || ""); setDescription(offer.description || "");
    setPrice(offer.price ? String(offer.price) : ""); setCategoryTag(offer.category_tag || "");
    setDisplayType(offer.display_type || "card"); setPixKey(offer.pix_key || "");
    setPixKeyType(offer.pix_key_type || "telefone"); setCardPaymentUrl(offer.card_payment_url || "");
    setImageFile(null); setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingOffer && !selectedProductId) throw new Error("Selecione um produto");
      setUploading(true);
      const product = products?.find((p: any) => p.id === selectedProductId);
      let imageUrl: string | null = editingOffer?.image_url || null;
      if (imageFile) imageUrl = await uploadImage(imageFile);
      else if (!editingOffer && product?.page_logo) imageUrl = product.page_logo;

      if (editingOffer) {
        const { error } = await supabase.from("member_area_offers" as any).update({
          description: description || null, image_url: imageUrl, price: price ? parseFloat(price) : null,
          category_tag: categoryTag || null, display_type: displayType,
          pix_key: pixKey || null, pix_key_type: pixKeyType, card_payment_url: cardPaymentUrl || null,
        }).eq("id", editingOffer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("member_area_offers" as any).insert({
          workspace_id: workspaceId, name: product?.name || "Oferta", product_id: selectedProductId,
          description: description || null, image_url: imageUrl,
          price: price ? parseFloat(price) : (product?.value || null),
          category_tag: categoryTag || null, display_type: displayType,
          pix_key: pixKey || null, pix_key_type: pixKeyType, card_payment_url: cardPaymentUrl || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editingOffer ? "Oferta atualizada!" : "Oferta adicionada!"); queryClient.invalidateQueries({ queryKey: ["member-area-offers"] }); resetForm(); setDialogOpen(false); },
    onError: (err: Error) => { toast.error(err.message); setUploading(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("member_area_offers" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Oferta removida"); queryClient.invalidateQueries({ queryKey: ["member-area-offers"] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from("member_area_offers" as any).update({ is_active: active }).eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["member-area-offers"] }),
  });

  const selectedProduct = products?.find((p: any) => p.id === selectedProductId);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Oferta</Button></DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingOffer ? "Editar Oferta" : "Nova Oferta"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {!editingOffer && (
                <div>
                  <Label>Produto</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                    <SelectContent>{products?.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              )}
              {(selectedProduct || editingOffer) && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  {(selectedProduct?.page_logo || editingOffer?.image_url) && <img src={editingOffer?.image_url || selectedProduct?.page_logo} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                  <div>
                    <p className="font-medium text-sm">{editingOffer?.name || selectedProduct?.name}</p>
                    {(selectedProduct?.value || editingOffer?.price) && <p className="text-xs text-muted-foreground">R$ {Number(editingOffer?.price || selectedProduct?.value).toFixed(2).replace(".", ",")}</p>}
                  </div>
                </div>
              )}
              <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Por que esse produto é especial..." /></div>
              <div>
                <Label>Imagem {editingOffer ? "(envie para substituir)" : "(opcional)"}</Label>
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
              <div><Label>Tag de categoria</Label><Input value={categoryTag} onChange={(e) => setCategoryTag(e.target.value)} placeholder="Ex: Material complementar" /></div>
              <div>
                <Label>Tipo de exibição</Label>
                <Select value={displayType} onValueChange={setDisplayType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Oferta Card</SelectItem>
                    <SelectItem value="showcase">Produto Físico (Vitrine)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo da chave PIX</Label>
                <Select value={pixKeyType} onValueChange={setPixKeyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Chave PIX</Label><Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Digite a chave PIX" /></div>
              <div><Label>Link do checkout (cartão)</Label><Input value={cardPaymentUrl} onChange={(e) => setCardPaymentUrl(e.target.value)} placeholder="https://checkout.exemplo.com/..." /></div>
              <div><Label>Preço (R$)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={selectedProduct?.value ? String(selectedProduct.value) : "0.00"} /></div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading || (!editingOffer && !selectedProductId)}>
                {saveMutation.isPending || uploading ? "Salvando..." : editingOffer ? "Salvar Alterações" : "Adicionar Oferta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : !offers?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma oferta cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((offer: any) => {
            const impressions = offer.total_impressions || 0;
            const clicks = offer.total_clicks || 0;
            const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "0";
            return (
              <Card key={offer.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {offer.image_url && <img src={offer.image_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{offer.name || (offer as any).title || "Oferta"}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        {offer.price && <span>R$ {Number(offer.price).toFixed(2).replace(".", ",")}</span>}
                        {(() => { const prod = products?.find((p: any) => p.id === offer.product_id); return prod?.name ? <Badge variant="secondary" className="text-[10px]">{prod.name}</Badge> : null; })()}
                        <Badge variant="outline" className="text-[10px]">{offer.display_type === "showcase" ? "Vitrine" : "Card"}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{impressions.toLocaleString("pt-BR")} views</span>
                        <span>{clicks.toLocaleString("pt-BR")} cliques</span>
                        <span>{ctr}% CTR</span>
                        {(offerConversions?.[offer.id] || 0) > 0 && (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
                            {offerConversions[offer.id]} conversões
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={offer.is_active} onCheckedChange={(checked) => toggleMutation.mutate({ id: offer.id, active: checked })} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(offer)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(offer.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----
export default function AreaMembros() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 md:px-6 space-y-8 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Área de Membros</h1>
          <p className="text-sm text-muted-foreground">Gerencie produtos, conteúdos e ofertas exclusivas</p>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-lg flex-wrap">
          <TabsTrigger value="products" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Users className="h-4 w-4" /> Membros
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <BookOpen className="h-4 w-4" /> Conteúdo
          </TabsTrigger>
          <TabsTrigger value="offers" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Gift className="h-4 w-4" /> Ofertas
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm">
            <Activity className="h-4 w-4" /> Atividade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products"><MemberProductsTab /></TabsContent>
        <TabsContent value="content"><ContentManagement /></TabsContent>
        <TabsContent value="offers"><MemberOffersTab /></TabsContent>
        <TabsContent value="activity"><MemberActivityTab /></TabsContent>
      </Tabs>
    </div>
  );
}
