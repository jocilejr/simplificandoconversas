import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";

export function AppSection() {
  const { profile, updateProfile } = useProfile();
  const [appPublicUrl, setAppPublicUrl] = useState("");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");

  useEffect(() => {
    if (profile) {
      setAppPublicUrl(profile.app_public_url || "");
      setMetaPixelId((profile as any).meta_pixel_id || "");
      setMetaAccessToken((profile as any).meta_access_token || "");
    }
  }, [profile]);

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
          <CardTitle className="text-lg">Meta Pixel (Conversions API)</CardTitle>
          <CardDescription>
            Configure o Pixel ID e Access Token para disparar eventos server-side via nó "Pixel Meta" nos fluxos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Pixel ID</Label>
            <Input
              placeholder="123456789012345"
              value={metaPixelId}
              onChange={(e) => setMetaPixelId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token</Label>
            <Input
              type="password"
              placeholder="EAAxxxxxxxx..."
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Gere em Meta Events Manager → Configurações → Conversions API → Gerar Token de Acesso.
            </p>
          </div>
          <Button
            onClick={() => updateProfile.mutate({ meta_pixel_id: metaPixelId, meta_access_token: metaAccessToken })}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
