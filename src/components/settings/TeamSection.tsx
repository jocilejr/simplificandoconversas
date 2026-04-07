import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace, ALL_PERMISSIONS } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Loader2, Trash2, UserPlus, Shield, Eye, Pencil, Settings2 } from "lucide-react";

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, boolean>;
  created_at: string;
  profile?: { full_name: string | null; user_id: string } | null;
}

const roleLabels: Record<string, { label: string; icon: any; color: string }> = {
  admin: { label: "Admin", icon: Shield, color: "bg-primary/10 text-primary border-primary/20" },
  operator: { label: "Operador", icon: Pencil, color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" },
  viewer: { label: "Visualizador", icon: Eye, color: "bg-muted text-muted-foreground border-border" },
};

export function TeamSection() {
  const { workspaceId, isAdmin, isSuperAdmin } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("operator");
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});

  const canManage = isAdmin || isSuperAdmin;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, permissions, created_at")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;

      const userIds = (data || []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      return (data || []).map((m) => ({
        ...m,
        permissions: (m.permissions as Record<string, boolean>) || {},
        profile: profiles?.find((p) => p.user_id === m.user_id) || null,
      })) as MemberRow[];
    },
  });

  const handleAddByEmail = async () => {
    if (!inviteEmail.trim() || !workspaceId || !user) return;
    setSaving(true);
    const email = inviteEmail.trim().toLowerCase();

    // Look up user by email via profiles table (joined with auth concept)
    // We need to find a profile whose user has this email
    // Since we can't query auth.users, we search profiles and match
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name");

    // We need to check auth.users email - use a workaround via workspace edge or direct lookup
    // Alternative: search by checking if user_id matches via supabase auth admin
    // For now, let's use the RPC or a simpler approach - lookup via the auth API isn't possible from client
    // Best approach: try to find the user by checking their session email match
    
    // Use supabase edge function or backend to resolve email -> user_id
    // For simplicity, let's use the backend API
    const backendUrl = localStorage.getItem("app_public_url") || "";
    
    if (backendUrl) {
      try {
        const res = await fetch(`${backendUrl}/api/resolve-user-by-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          const { userId: foundUserId } = await res.json();
          if (foundUserId) {
            const { error } = await supabase.from("workspace_members").insert({
              workspace_id: workspaceId,
              user_id: foundUserId,
              role: inviteRole as "admin" | "operator" | "viewer",
              invited_by: user.id,
              permissions: invitePerms,
            });
            if (error) {
              toast({ title: "Erro ao adicionar membro", description: error.message, variant: "destructive" });
            } else {
              toast({ title: "Membro adicionado!" });
              qc.invalidateQueries({ queryKey: ["workspace-members"] });
              setShowInvite(false);
              setInviteEmail("");
              setInviteRole("operator");
              setInvitePerms({});
            }
            setSaving(false);
            return;
          }
        }
      } catch {
        // fallback below
      }
    }

    toast({
      title: "Usuário não encontrado",
      description: "Nenhum usuário com este email foi encontrado. Verifique se ele já criou uma conta.",
      variant: "destructive",
    });
    setSaving(false);
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .update({ role: newRole as "admin" | "operator" | "viewer" })
      .eq("id", memberId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Papel atualizado!" });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    }
  };

  const handleSavePermissions = async () => {
    if (!editingMember) return;
    setSaving(true);
    const { error } = await supabase
      .from("workspace_members")
      .update({ permissions: editPerms })
      .eq("id", editingMember.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Permissões atualizadas!" });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
      setEditingMember(null);
    }
    setSaving(false);
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

  const openEditPerms = (member: MemberRow) => {
    setEditingMember(member);
    setEditPerms({ ...member.permissions });
  };

  const toggleAll = (perms: Record<string, boolean>, set: (p: Record<string, boolean>) => void, val: boolean) => {
    const updated: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach((p) => { updated[p.key] = val; });
    set(updated);
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
        {canManage && (
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
          const isWsAdmin = member.role === "admin";

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

                {canManage && !isCurrentUser ? (
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

                {/* Permissions button - only for non-admins */}
                {canManage && !isCurrentUser && !isWsAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => openEditPerms(member)}
                    title="Editar permissões"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                )}

                {canManage && !isCurrentUser && (
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

      {/* Add Member Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-md">
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
                  <SelectItem value="operator" className="text-xs">Operador — Edita dados</SelectItem>
                  <SelectItem value="viewer" className="text-xs">Visualizador — Somente leitura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteRole !== "admin" && (
              <PermissionsChecklist perms={invitePerms} setPerms={setInvitePerms} toggleAll={toggleAll} />
            )}
          </div>
          <DialogFooter>
            <Button size="sm" className="text-xs" onClick={handleAddByEmail} disabled={saving || !inviteEmail.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permissões</DialogTitle>
            <DialogDescription>
              Defina quais funcionalidades este membro pode acessar.
            </DialogDescription>
          </DialogHeader>
          <PermissionsChecklist perms={editPerms} setPerms={setEditPerms} toggleAll={toggleAll} />
          <DialogFooter>
            <Button size="sm" className="text-xs" onClick={handleSavePermissions} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermissionsChecklist({
  perms,
  setPerms,
  toggleAll,
}: {
  perms: Record<string, boolean>;
  setPerms: (p: Record<string, boolean>) => void;
  toggleAll: (p: Record<string, boolean>, set: (p: Record<string, boolean>) => void, val: boolean) => void;
}) {
  const allChecked = ALL_PERMISSIONS.every((p) => perms[p.key]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">Funcionalidades permitidas</label>
        <Button
          variant="ghost"
          size="sm"
          className="text-[10px] h-6 px-2"
          onClick={() => toggleAll(perms, setPerms, !allChecked)}
        >
          {allChecked ? "Desmarcar tudo" : "Marcar tudo"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
        {ALL_PERMISSIONS.map((p) => (
          <label key={p.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 cursor-pointer">
            <Checkbox
              checked={!!perms[p.key]}
              onCheckedChange={(checked) =>
                setPerms({ ...perms, [p.key]: !!checked })
              }
            />
            <span className="text-xs">{p.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
