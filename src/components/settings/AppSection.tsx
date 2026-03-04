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

  useEffect(() => {
    if (profile) setAppPublicUrl(profile.app_public_url || "");
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
          <CardTitle className="text-lg">Webhook</CardTitle>
          <CardDescription>
            URL do webhook configurada automaticamente ao criar instâncias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <Input
              readOnly
              value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`}
              onClick={(e) => {
                (e.target as HTMLInputElement).select();
                navigator.clipboard.writeText(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              Clique para copiar. Este webhook é configurado automaticamente nas novas instâncias.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
