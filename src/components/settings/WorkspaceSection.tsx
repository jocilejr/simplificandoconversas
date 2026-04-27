import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Check, X } from "lucide-react";

function WorkspaceRow({ ws, onRenamed }: { ws: { id: string; name: string }; onRenamed: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ws.name);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim() || name.trim() === ws.name) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim() })
      .eq("id", ws.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Workspace renomeado!" });
      onRenamed();
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setName(ws.name);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
      <div className="h-8 w-8 rounded-md bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
        {ws.name.slice(0, 2).toUpperCase()}
      </div>
      {editing ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            className="h-8 text-sm flex-1"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCancel} disabled={saving}>
            <X className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium">{ws.name}</span>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

export function WorkspaceSection() {
  const { workspaceId, workspace, isSuperAdmin } = useWorkspace();
  const qc = useQueryClient();

  const { data: allWorkspaces, isLoading } = useQuery({
    queryKey: ["all-workspaces-for-rename"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const workspaceList = isSuperAdmin
    ? (allWorkspaces || [])
    : workspace ? [{ id: workspace.id, name: workspace.name }] : [];

  const handleRenamed = () => {
    qc.invalidateQueries({ queryKey: ["all-workspaces-for-rename"] });
    qc.invalidateQueries({ queryKey: ["workspaces"] });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Configuração do Workspace</CardTitle>
        <CardDescription>
          Renomeie os workspaces clicando no ícone de edição.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : workspaceList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum workspace encontrado.</p>
        ) : (
          workspaceList.map((ws) => (
            <WorkspaceRow key={ws.id} ws={ws} onRenamed={handleRenamed} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
