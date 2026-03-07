import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";

export function AISection() {
  const { profile, updateProfile } = useProfile();
  const [openaiKey, setOpenaiKey] = useState("");

  useEffect(() => {
    if (profile) setOpenaiKey(profile.openai_api_key || "");
  }, [profile]);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">OpenAI</CardTitle>
        <CardDescription>Configure sua API Key da OpenAI para usar o nó Agente IA</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder="sk-..."
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Obtenha sua chave em{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
              platform.openai.com/api-keys
            </a>
          </p>
        </div>
        <Button
          onClick={() => updateProfile.mutate({ openai_api_key: openaiKey })}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
