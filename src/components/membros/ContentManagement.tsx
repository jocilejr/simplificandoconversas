import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadMediaFile } from "@/lib/uploadMedia";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { Plus, Trash2, FolderPlus, FileText, ArrowLeft, Video, Image, Download, Upload, Loader2, Music, Edit } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const typeIcons: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  text: { icon: FileText, color: "#6366f1", label: "Texto" },
  pdf: { icon: Download, color: "#ef4444", label: "PDF" },
  video: { icon: Video, color: "#8b5cf6", label: "Vídeo" },
  image: { icon: Image, color: "#10b981", label: "Imagem" },
  audio: { icon: Music, color: "#f59e0b", label: "Áudio" },
};

export default function ContentManagement() {
  const { workspaceId } = useWorkspace();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ["delivery-products-content", workspaceId],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products" as any).select("id, name, member_cover_image, page_logo").eq("workspace_id", workspaceId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!workspaceId,
  });

  if (!selectedProductId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Selecione um produto para gerenciar o conteúdo:</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products?.map((p: any) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-l-4 border-l-primary/30 hover:border-l-primary group overflow-hidden"
              onClick={() => setSelectedProductId(p.id)}
            >
              {(p.member_cover_image || p.page_logo) ? (
                <div className="relative h-24 w-full">
                  <img src={p.member_cover_image || p.page_logo} alt={p.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <span className="absolute bottom-2 left-3 right-3 font-bold text-white text-sm truncate drop-shadow-md">{p.name}</span>
                </div>
              ) : (
                <div className="p-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">{p.name}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
        {!products?.length && <p className="text-center py-8 text-muted-foreground">Nenhum produto ativo encontrado</p>}
      </div>
    );
  }

  const product = products?.find((p: any) => p.id === selectedProductId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedProductId(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h3 className="font-bold text-lg text-foreground">{(product as any)?.name}</h3>
      </div>
      <ProductContentEditor productId={selectedProductId} workspaceId={workspaceId!} />
    </div>
  );
}

function ProductContentEditor({ productId, workspaceId }: { productId: string; workspaceId: string }) {
  const queryClient = useQueryClient();
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [matDialogOpen, setMatDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("📖");
  const [catDesc, setCatDesc] = useState("");
  const [matTitle, setMatTitle] = useState("");
  const [matDesc, setMatDesc] = useState("");
  const [matType, setMatType] = useState("text");
  const [matUrl, setMatUrl] = useState("");
  const [matText, setMatText] = useState("");
  const [matButtonLabel, setMatButtonLabel] = useState("");
  const [matCategoryId, setMatCategoryId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prodCoverUrl, setProdCoverUrl] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [uploadingProdCover, setUploadingProdCover] = useState(false);
  const [prodSettingsLoaded, setProdSettingsLoaded] = useState(false);
  const prodCoverInputRef = useRef<HTMLInputElement>(null);

  const { data: productData } = useQuery({
    queryKey: ["product-detail", productId],
    queryFn: async () => {
      const { data } = await supabase.from("delivery_products" as any).select("member_cover_image, member_description").eq("id", productId).single();
      return data;
    },
  });

  if (productData && !prodSettingsLoaded) {
    setProdCoverUrl((productData as any).member_cover_image || "");
    setProdDescription((productData as any).member_description || "");
    setProdSettingsLoaded(true);
  }

  const { data: categories } = useQuery<any[]>({
    queryKey: ["admin-categories", productId],
    queryFn: async () => {
      const { data } = await supabase.from("member_product_categories" as any).select("*").eq("product_id", productId).order("sort_order");
      return data || [];
    },
  });

  const { data: materials } = useQuery({
    queryKey: ["admin-materials", productId],
    queryFn: async () => {
      const { data } = await supabase.from("member_product_materials" as any).select("*").eq("product_id", productId).order("sort_order");
      return data || [];
    },
  });

  const uploadFile = async (file: File, setter: (url: string) => void, setLoading: (v: boolean) => void) => {
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 20MB)"); return; }
    setLoading(true);
    try {
      const url = await uploadMediaFile(file);
      setter(url);
      toast.success("Arquivo enviado!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, setMatUrl, setUploading);
  };

  const saveProdSettingsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("delivery_products" as any).update({
        member_cover_image: prodCoverUrl || null,
        member_description: prodDescription || null,
      }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Personalização salva!"); queryClient.invalidateQueries({ queryKey: ["product-detail", productId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCatMutation = useMutation({
    mutationFn: async () => {
      if (!catName) throw new Error("Nome é obrigatório");
      const { error } = await supabase.from("member_product_categories" as any).insert({ workspace_id: workspaceId, product_id: productId, name: catName, icon: catIcon || "📖", description: catDesc || null, sort_order: (categories?.length || 0) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Categoria criada!"); queryClient.invalidateQueries({ queryKey: ["admin-categories", productId] }); setCatName(""); setCatIcon("📖"); setCatDesc(""); setCatDialogOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("member_product_categories" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Categoria removida"); queryClient.invalidateQueries({ queryKey: ["admin-categories", productId] }); queryClient.invalidateQueries({ queryKey: ["admin-materials", productId] }); },
  });

  const addMatMutation = useMutation({
    mutationFn: async () => {
      if (!matTitle) throw new Error("Título é obrigatório");
      const { error } = await supabase.from("member_product_materials" as any).insert({
        workspace_id: workspaceId, product_id: productId,
        category_id: matCategoryId && matCategoryId !== "none" ? matCategoryId : null,
        title: matTitle, description: matDesc || null, content_type: matType,
        content_url: matUrl || null, content_text: matText || null,
        button_label: matType === "text" && matButtonLabel ? matButtonLabel : null,
        sort_order: (materials?.length || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Material adicionado!"); queryClient.invalidateQueries({ queryKey: ["admin-materials", productId] }); resetMatForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMatMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("member_product_materials" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Material removido"); queryClient.invalidateQueries({ queryKey: ["admin-materials", productId] }); },
  });

  const updateMatMutation = useMutation({
    mutationFn: async () => {
      if (!editingMaterial || !matTitle) throw new Error("Título é obrigatório");
      console.log("[updateMat] content_url:", matUrl, "id:", editingMaterial.id);
      const { error } = await supabase.from("member_product_materials" as any).update({
        category_id: matCategoryId && matCategoryId !== "none" ? matCategoryId : null,
        title: matTitle, description: matDesc || null, content_type: matType,
        content_url: matUrl || null, content_text: matText || null,
        button_label: matType === "text" && matButtonLabel ? matButtonLabel : null,
      }).eq("id", editingMaterial.id);
      if (error) { console.error("[updateMat] error:", error); throw error; }
    },
    onSuccess: () => { toast.success("Material atualizado!"); queryClient.invalidateQueries({ queryKey: ["admin-materials", productId] }); resetMatForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMatForm = () => {
    setMatTitle(""); setMatDesc(""); setMatType("text"); setMatUrl(""); setMatText(""); setMatButtonLabel(""); setMatCategoryId(""); setEditingMaterial(null); setMatDialogOpen(false);
  };

  const openEditMaterial = (mat: any) => {
    setEditingMaterial(mat); setMatTitle(mat.title || ""); setMatDesc(mat.description || ""); setMatType(mat.content_type || "text");
    setMatUrl(mat.content_url || ""); setMatText(mat.content_text || ""); setMatButtonLabel(mat.button_label || "");
    setMatCategoryId(mat.category_id || "none"); setMatDialogOpen(true);
  };

  const contentTypes = [
    { value: "text", label: "Texto (com botão opcional)" },
    { value: "pdf", label: "PDF (upload)" },
    { value: "video", label: "Vídeo (URL)" },
    { value: "image", label: "Imagem (upload)" },
    { value: "audio", label: "Áudio (upload)" },
  ];

  return (
    <div className="space-y-8">
      {/* Product-level customization */}
      <div className="bg-muted/50 rounded-xl border border-border p-5 space-y-4">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <Image className="h-4 w-4 text-primary" /> Personalização do Produto
        </h4>
        <p className="text-xs text-muted-foreground -mt-2">Imagem de capa e descrição exibidos na área do membro.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Imagem de capa</Label>
            <input ref={prodCoverInputRef} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file, setProdCoverUrl, setUploadingProdCover); }} className="hidden" />
            {prodCoverUrl ? (
              <div className="space-y-2">
                <img src={prodCoverUrl} alt="Capa" className="w-full h-32 rounded-lg object-cover border border-border" />
                <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => { setProdCoverUrl(""); if (prodCoverInputRef.current) prodCoverInputRef.current.value = ""; }}>Remover imagem</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full h-24 flex-col gap-1" onClick={() => prodCoverInputRef.current?.click()} disabled={uploadingProdCover}>
                {uploadingProdCover ? <><Loader2 className="h-5 w-5 animate-spin" /><span className="text-xs">Enviando...</span></> : <><Upload className="h-5 w-5" /><span className="text-xs">Selecionar imagem</span></>}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label>Mini texto / Descrição</Label>
            <Textarea value={prodDescription} onChange={(e) => setProdDescription(e.target.value)} placeholder="Ex: Material exclusivo preparado com carinho..." rows={4} />
          </div>
        </div>
        <Button size="sm" onClick={() => saveProdSettingsMutation.mutate()} disabled={saveProdSettingsMutation.isPending}>
          {saveProdSettingsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          Salvar personalização
        </Button>
      </div>

      {/* Categories */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-foreground flex items-center gap-2"><FolderPlus className="h-4 w-4 text-primary" /> Categorias / Módulos</h4>
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Nova Categoria</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ex: Módulo 1" /></div>
                <div><Label>Ícone (emoji)</Label><Input value={catIcon} onChange={(e) => setCatIcon(e.target.value)} className="w-20" /></div>
                <div><Label>Descrição (opcional)</Label><Input value={catDesc} onChange={(e) => setCatDesc(e.target.value)} /></div>
                <Button className="w-full" onClick={() => addCatMutation.mutate()} disabled={addCatMutation.isPending}>Criar Categoria</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {!categories?.length ? (
          <p className="text-sm text-muted-foreground py-2">Nenhuma categoria. Materiais ficarão sem agrupamento.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat: any) => (
              <div key={cat.id} className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3 border border-border group hover:bg-muted/80 transition-colors">
                <span className="text-xl">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{cat.name}</p>
                  {cat.description && <p className="text-[10px] text-muted-foreground truncate">{cat.description}</p>}
                </div>
                <button onClick={() => deleteCatMutation.mutate(cat.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Materials */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-foreground flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Materiais</h4>
          <Dialog open={matDialogOpen} onOpenChange={(open) => { if (!open) resetMatForm(); else setMatDialogOpen(open); }}>
            <DialogTrigger asChild><Button size="sm" onClick={() => { resetMatForm(); setMatDialogOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1" /> Novo Material</Button></DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingMaterial ? "Editar Material" : "Novo Material"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input value={matTitle} onChange={(e) => setMatTitle(e.target.value)} placeholder="Ex: Aula 1" /></div>
                <div><Label>Descrição (opcional)</Label><Input value={matDesc} onChange={(e) => setMatDesc(e.target.value)} /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={matCategoryId} onValueChange={setMatCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories?.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de conteúdo</Label>
                  <Select value={matType} onValueChange={setMatType} disabled={!!editingMaterial}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{contentTypes.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {matType === "text" ? (
                  <>
                    <div><Label>Conteúdo de texto</Label><Textarea value={matText} onChange={(e) => setMatText(e.target.value)} placeholder="Digite o conteúdo aqui..." rows={8} /></div>
                    <div><Label>URL do botão (opcional)</Label><Input value={matUrl} onChange={(e) => setMatUrl(e.target.value)} placeholder="https://..." /></div>
                    {matUrl && <div><Label>Texto do botão</Label><Input value={matButtonLabel} onChange={(e) => setMatButtonLabel(e.target.value)} placeholder="Acessar" /></div>}
                  </>
                ) : matType === "video" ? (
                  <div><Label>URL do vídeo</Label><Input value={matUrl} onChange={(e) => setMatUrl(e.target.value)} placeholder="https://youtube.com/..." /></div>
                ) : (
                  <div className="space-y-2">
                    <Label>{matType === "pdf" ? "Arquivo PDF" : matType === "audio" ? "Arquivo de Áudio" : "Arquivo de Imagem"}</Label>
                    <input ref={fileInputRef} type="file" accept={matType === "pdf" ? ".pdf" : matType === "audio" ? "audio/*" : "image/*"} onChange={handleFileUpload} className="hidden" />
                    {matUrl ? (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate flex-1">{matUrl.split("/").pop()}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => { setMatUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Trocar</Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : <><Upload className="h-4 w-4 mr-2" /> Selecionar arquivo</>}
                      </Button>
                    )}
                  </div>
                )}
                <Button className="w-full" onClick={() => editingMaterial ? updateMatMutation.mutate() : addMatMutation.mutate()} disabled={addMatMutation.isPending || updateMatMutation.isPending || uploading}>
                  {editingMaterial ? "Salvar Alterações" : "Adicionar Material"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {!materials?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum material cadastrado</p>
        ) : (
          <div className="space-y-2">
            {materials.map((mat: any) => {
              const typeInfo = typeIcons[mat.content_type] || typeIcons.text;
              const TypeIcon = typeInfo.icon;
              return (
                <div key={mat.id} className="flex items-center gap-3 bg-card rounded-xl px-4 py-3 border border-border group hover:shadow-sm transition-all">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${typeInfo.color}20` }}>
                    <TypeIcon className="h-4 w-4" style={{ color: typeInfo.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{mat.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}>{typeInfo.label}</span>
                      {mat.category_id && categories?.find((c: any) => c.id === mat.category_id)?.name && <span className="text-[10px] text-muted-foreground">📁 {categories.find((c: any) => c.id === mat.category_id)?.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => openEditMaterial(mat)} className="text-muted-foreground hover:text-primary p-1"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => deleteMatMutation.mutate(mat.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
