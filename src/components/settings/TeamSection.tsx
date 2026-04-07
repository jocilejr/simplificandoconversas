import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Trash2, UserPlus, Shield, Eye, Pencil } from "lucide-react";

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: { full_name: string | null; user_id: string } | null;
  email?: string;
}

const roleLabels: Record<string, { label: string; icon: any; color: string }> = {
  admin: { label: "Admin", icon: Shield, color: "bg-primary/10 text-primary border-primary/20" },
  operator: { label: "Operador", icon: Pencil, color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" },
  viewer: { label: "Visualizador", icon: Eye, color: "bg-muted text-muted-foreground border-border" },
};

export function TeamSection() {
  const { workspaceId, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("operator");
  const [saving, setSaving] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, created_at")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;

      // Fetch profiles for display names
      const userIds = (data || []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      return (data || []).map((m) => ({
        ...m,
        profile: profiles?.find((p) => p.user_id === m.user_id) || null,
      })) as MemberRow[];
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !workspaceId || !user) return;
    setSaving(true);

    // Look up user by email via profiles or auth - we need to find user_id by email
    // Since we can't query auth.users, we'll try to find by looking at existing approach
    // For now, lookup by checking if user exists via a workaround
    const { data: existingProfiles } = await supabase
      .from("profiles")
      .select("user_id");
    
    // We need a different approach - let's use supabase admin to find users
    // Since client can't query auth.users, we'll add member by user_id lookup
    // For simplicity, let's check if there's a matching profile
    // In a real scenario, this would use an edge function or backend endpoint
    
    toast({
      title: "Convite por email",
      description: "Para convidar usuários, compartilhe o email e peça para criar uma conta. Depois adicione pelo ID do usuário.",
      variant: "destructive",
    });
    
    setSaving(false);
  };

  const handleAddByUserId = async () => {
    if (!inviteEmail.trim() || !workspaceId || !user) return;
    setSaving(true);

    // Try to treat input as user_id (UUID) first
    const userId = inviteEmail.trim();

    const { error } = await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: inviteRole as "admin" | "operator" | "viewer",
      invited_by: user.id,
    });

    if (error) {
      toast({ title: "Erro ao adicionar membro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Membro adicionado!" });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("operator");
    }
    setSaving(false);
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Papel atualizado!" });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    }
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Membro removido!" });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Equipe</h2>
          <p className="text-xs text-muted-foreground">
            Gerencie os membros e permissões do workspace
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Adicionar Membro
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const name = member.profile?.full_name || member.user_id.slice(0, 8);
          const initials = name.slice(0, 2).toUpperCase();
          const isCurrentUser = member.user_id === user?.id;
          const roleInfo = roleLabels[member.role] || roleLabels.viewer;
          const RoleIcon = roleInfo.icon;

          return (
            <Card key={member.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{name}</span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-[10px] h-4">Você</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{member.user_id}</p>
                </div>

                {isAdmin && !isCurrentUser ? (
                  <Select
                    value={member.role}
                    onValueChange={(val) => handleChangeRole(member.id, val)}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                      <SelectItem value="operator" className="text-xs">Operador</SelectItem>
                      <SelectItem value="viewer" className="text-xs">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${roleInfo.color}`}>
                    <RoleIcon className="h-3 w-3" />
                    {roleInfo.label}
                  </Badge>
                )}

                {isAdmin && !isCurrentUser && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover membro</AlertDialogTitle>
                        <AlertDialogDescription>
                          Este membro perderá acesso a todos os dados deste workspace.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="text-xs" onClick={() => handleRemove(member.id)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
            <DialogDescription>
              Informe o ID do usuário (UUID) para adicionar ao workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">ID do Usuário</label>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Papel</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-xs">Admin — Acesso total</SelectItem>
                  <SelectItem value="operator" className="text-xs">Operador — Edita dados, sem configurações</SelectItem>
                  <SelectItem value="viewer" className="text-xs">Visualizador — Somente leitura</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" className="text-xs" onClick={handleAddByUserId} disabled={saving || !inviteEmail.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
