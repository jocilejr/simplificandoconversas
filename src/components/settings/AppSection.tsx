import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function ReadOnlyUrlField({ label, value, hint }: { label: string; value: string; hint: string }) {
  const { toast } = useToast();
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs bg-muted/50" />
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast({ title: "URL copiada!" });
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AppSection() {
  const { profile, updateProfile } = useProfile();
  const { workspaceId } = useWorkspace();

  // Auto-detected URLs (read-only)
  const detectedAppUrl = typeof window !== "undefined" ? window.location.origin : "";
  const detectedApiUrl = import.meta.env.VITE_SUPABASE_URL || "";

  const persistedAppRef = useRef(false);
  const persistedApiRef = useRef(false);

  // Auto-persist app_public_url in profiles (silent, idempotent)
  useEffect(() => {
    if (!profile || persistedAppRef.current || !detectedAppUrl) return;
    if (profile.app_public_url !== detectedAppUrl) {
      persistedAppRef.current = true;
      updateProfile.mutate({ app_public_url: detectedAppUrl } as any);
    } else {
      persistedAppRef.current = true;
    }
  }, [profile, detectedAppUrl]);

  // Auto-persist api_public_url in workspaces (silent, idempotent)
  useEffect(() => {
    if (!workspaceId || persistedApiRef.current || !detectedApiUrl) return;
    persistedApiRef.current = true;
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("api_public_url")
        .eq("id", workspaceId)
        .single();
      if (data?.api_public_url !== detectedApiUrl) {
        await supabase.from("workspaces").update({ api_public_url: detectedApiUrl }).eq("id", workspaceId);
      }
    })();
  }, [workspaceId, detectedApiUrl]);

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Domínios da Aplicação</CardTitle>
          <CardDescription>
            URLs detectadas automaticamente do ambiente. Usadas para gerar links de rastreamento e webhooks de integração.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReadOnlyUrlField
            label="URL Pública do App (frontend)"
            value={detectedAppUrl}
            hint="Detectado automaticamente do navegador. Usado em links rastreáveis e área de membros."
          />
          <ReadOnlyUrlField
            label="URL da API (backend)"
            value={detectedApiUrl}
            hint="Detectado automaticamente do build da VPS. Usado em webhooks de integração (Yampi, Mercado Pago, etc)."
          />
        </CardContent>
      </Card>

    </div>
  );
}
