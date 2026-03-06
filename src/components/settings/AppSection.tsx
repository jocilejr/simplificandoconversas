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
    </div>
  );
}
