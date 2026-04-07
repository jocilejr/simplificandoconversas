import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { workspace, workspaces, setActiveWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const slug = "ws-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { error } = await supabase
      .from("workspaces")
      .insert({ name: newName.trim(), slug, created_by: user.id });
    if (error) {
      toast({ title: "Erro ao criar workspace", description: error.message, variant: "destructive" });
      setCreating(false);
      return;
    }
    toast({ title: "Workspace criado!" });
    // Wait a moment for the trigger to create workspace_members, then refetch
    await new Promise((r) => setTimeout(r, 600));
    const result = await qc.fetchQuery({ queryKey: ["workspaces", user.id], staleTime: 0 });
    const list = result as Array<{ id: string; slug: string }> | undefined;
    const created = list?.find((w) => w.slug === slug);
    if (created) {
      setActiveWorkspace(created.id);
    }
    setShowCreate(false);
    setNewName("");
    setCreating(false);
  };

  if (!workspace) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-sidebar-accent/80 transition-colors text-left">
            <div className="h-6 w-6 rounded-md bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
              {workspace.name.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <span className="text-[11px] font-medium text-sidebar-foreground truncate flex-1">
                  {workspace.name}
                </span>
                <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
              className="text-xs gap-2"
            >
              <div className="h-5 w-5 rounded bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                {ws.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate flex-1">{ws.name}</span>
              {ws.id === workspace.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreate(true)} className="text-xs gap-2">
            <Plus className="h-3.5 w-3.5" />
            Novo Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="Nome do workspace"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
