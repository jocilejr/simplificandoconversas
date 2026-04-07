import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { useMetaPixels, type MetaPixel } from "@/hooks/useMetaPixels";
import { Loader2, Plus, Trash2, Pencil, Check, X, Eye, EyeOff, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function PixelRow({ pixel, onUpdate, onDelete, isDeleting }: {
  pixel: MetaPixel;
  onUpdate: (id: string, data: { name?: string; pixel_id?: string; access_token?: string }) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pixel.name);
  const [pixelId, setPixelId] = useState(pixel.pixel_id);
  const [accessToken, setAccessToken] = useState(pixel.access_token);
  const [showToken, setShowToken] = useState(false);
  const [showEditToken, setShowEditToken] = useState(false);
  const { toast } = useToast();

  if (!editing) {
    return (
      <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-secondary/30">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{pixel.name}</p>
            <p className="text-xs text-muted-foreground truncate">ID: {pixel.pixel_id}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => onDelete(pixel.id)} disabled={isDeleting}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground font-mono truncate flex-1">
            Token: {showToken ? pixel.access_token : `${pixel.access_token.substring(0, 20)}...`}
          </p>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setShowToken(!showToken)}>
            {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
            navigator.clipboard.writeText(pixel.access_token);
            toast({ title: "Token copiado!" });
          }}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-primary/50 bg-secondary/30 space-y-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Pixel ID</Label>
        <Input value={pixelId} onChange={(e) => setPixelId(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Access Token</Label>
        <div className="flex gap-1">
          <Input type={showEditToken ? "text" : "password"} value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="h-8 text-xs flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowEditToken(!showEditToken)}>
            {showEditToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="text-xs" onClick={() => { onUpdate(pixel.id, { name, pixel_id: pixelId, access_token: accessToken }); setEditing(false); }}>
          <Check className="h-3 w-3 mr-1" /> Salvar
        </Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditing(false)}>
          <X className="h-3 w-3 mr-1" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
export function AppSection() {
  const { profile, updateProfile } = useProfile();
  const { pixels, isLoading: pixelsLoading, addPixel, updatePixel, deletePixel } = useMetaPixels();
  const { workspaceId } = useWorkspace();
  const [appPublicUrl, setAppPublicUrl] = useState("");
  const [apiPublicUrl, setApiPublicUrl] = useState("");
  const [showAddPixel, setShowAddPixel] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPixelId, setNewPixelId] = useState("");
  const [newAccessToken, setNewAccessToken] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setAppPublicUrl(profile.app_public_url || "");
    }
  }, [profile]);

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from("workspaces").select("api_public_url").eq("id", workspaceId).single().then(({ data }) => {
      setApiPublicUrl(data?.api_public_url || "");
    });
  }, [workspaceId]);

  const handleAddPixel = () => {
    if (!newPixelId.trim() || !newAccessToken.trim()) return;
    addPixel.mutate(
      { name: newName || `Pixel ${pixels.length + 1}`, pixel_id: newPixelId, access_token: newAccessToken },
      {
        onSuccess: () => {
          setNewName("");
          setNewPixelId("");
          setNewAccessToken("");
          setShowAddPixel(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">URL Pública do App</CardTitle>
          <CardDescription>
            URL publicada do seu app. Usada para gerar links de rastreamento com domínio personalizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL Publicada</Label>
            <Input
              placeholder="https://seuapp.lovable.app"
              value={appPublicUrl}
              onChange={(e) => setAppPublicUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ex: https://simplificandoconversas.lovable.app
            </p>
          </div>
          <Button
            onClick={() => updateProfile.mutate({ app_public_url: appPublicUrl })}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Meta Pixels (Conversions API)</CardTitle>
          <CardDescription>
            Gerencie múltiplos pixels. Cada pixel poderá ser selecionado individualmente nos nós "Pixel Meta" dos fluxos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pixelsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {pixels.length === 0 && !showAddPixel && (
                <p className="text-sm text-muted-foreground">Nenhum pixel configurado. Adicione um para começar.</p>
              )}
              <div className="space-y-2">
                {pixels.map((pixel) => (
                  <PixelRow
                    key={pixel.id}
                    pixel={pixel}
                    onUpdate={(id, data) => updatePixel.mutate({ id, ...data })}
                    onDelete={(id) => deletePixel.mutate(id)}
                    isDeleting={deletePixel.isPending}
                  />
                ))}
              </div>
            </>
          )}

          {showAddPixel && (
            <div className="p-3 rounded-lg border border-dashed border-primary/50 space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome (identificação)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Pixel Principal" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pixel ID</Label>
                <Input value={newPixelId} onChange={(e) => setNewPixelId(e.target.value)} placeholder="123456789012345" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Access Token</Label>
                <Input type="password" value={newAccessToken} onChange={(e) => setNewAccessToken(e.target.value)} placeholder="EAAxxxxxxxx..." className="h-8 text-xs" />
                <p className="text-[10px] text-muted-foreground">
                  Gere em Meta Events Manager → Configurações → Conversions API → Gerar Token de Acesso.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={handleAddPixel} disabled={addPixel.isPending}>
                  {addPixel.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  <Check className="h-3 w-3 mr-1" /> Adicionar
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddPixel(false)}>
                  <X className="h-3 w-3 mr-1" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {!showAddPixel && (
            <Button variant="outline" size="sm" onClick={() => setShowAddPixel(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Pixel
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
