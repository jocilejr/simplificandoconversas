import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";

export function ProfileSection() {
  const { profile, updateProfile } = useProfile();
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (profile) setFullName(profile.full_name || "");
  }, [profile]);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Perfil</CardTitle>
        <CardDescription>Gerencie seus dados de perfil</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            placeholder="Seu nome"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <Button
          onClick={() => updateProfile.mutate({ full_name: fullName })}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar Perfil
        </Button>
      </CardContent>
    </Card>
  );
}
