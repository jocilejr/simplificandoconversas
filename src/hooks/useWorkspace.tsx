import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const ALL_PERMISSIONS = [
  
  { key: "chatbot", label: "Fluxos" },
  { key: "email", label: "E-mail" },
  { key: "reminders", label: "Lembretes" },
  { key: "leads", label: "Leads" },
  { key: "transacoes", label: "Transações" },
  { key: "relatorio", label: "Relatório" },
  { key: "recuperacao", label: "Recuperação" },
  { key: "gerar_boleto", label: "Gerar Boleto" },
  { key: "grupos", label: "Grupos" },
  { key: "area_membros", label: "Área de Membros" },
  { key: "entrega", label: "Entrega Digital" },
  { key: "links_uteis", label: "Links Úteis" },
  { key: "respostas_rapidas", label: "Respostas Rápidas" },
  { key: "settings", label: "Configurações" },
  { key: "disparar_fluxo", label: "Disparar Fluxo" },
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number]["key"];

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
  permissions: Record<string, boolean>;
}

interface WorkspaceContextType {
  workspaceId: string | null;
  workspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
  role: string | null;
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
  canWrite: boolean;
  isSuperAdmin: boolean;
  permissions: Record<string, boolean>;
  hasPermission: (key: PermissionKey) => boolean;
  setActiveWorkspace: (id: string) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceId: null,
  workspace: null,
  workspaces: [],
  role: null,
  isAdmin: false,
  isOperator: false,
  isViewer: false,
  canWrite: false,
  isSuperAdmin: false,
  permissions: {},
  hasPermission: () => false,
  setActiveWorkspace: () => {},
  isLoading: true,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(
    () => localStorage.getItem("active_workspace_id")
  );

  // Check if user is Super Admin (app_role = 'admin')
  const { data: isSuperAdmin = false, isLoading: isSuperAdminLoading } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  const { data: workspaces = [], isLoading: isWorkspacesLoading } = useQuery({
    queryKey: ["workspaces", user?.id, isSuperAdmin],
    enabled: !!user && !isSuperAdminLoading,
    queryFn: async () => {
      if (isSuperAdmin) {
        // Super Admin: load ALL workspaces
        const { data: ws, error } = await supabase
          .from("workspaces")
          .select("id, name, slug, logo_url")
          .order("name");
        if (error) throw error;
        return (ws || []).map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          logo_url: w.logo_url,
          role: "admin" as string,
          permissions: {} as Record<string, boolean>, // super admin ignores permissions
        }));
      }

      // Regular user: only workspaces they're members of
      const { data: members, error: mErr } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, permissions")
        .eq("user_id", user!.id);
      if (mErr) throw mErr;
      if (!members || members.length === 0) return [];

      const wsIds = members.map((m) => m.workspace_id);
      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .select("id, name, slug, logo_url")
        .in("id", wsIds);
      if (wsErr) throw wsErr;

      return (ws || []).map((w) => {
        const member = members.find((m) => m.workspace_id === w.id);
        return {
          id: w.id,
          name: w.name,
          slug: w.slug,
          logo_url: w.logo_url,
          role: member?.role || "viewer",
          permissions: (member?.permissions as Record<string, boolean>) || {},
        };
      });
    },
  });

  useEffect(() => {
    if (workspaces.length > 0) {
      const stored = localStorage.getItem("active_workspace_id");
      const valid = workspaces.find((w) => w.id === stored);
      if (!valid) {
        const first = workspaces[0];
        setActiveId(first.id);
        localStorage.setItem("active_workspace_id", first.id);
      } else if (!activeId) {
        setActiveId(stored);
      }
    }
  }, [workspaces]);

  const workspace = workspaces.find((w) => w.id === activeId) || workspaces[0] || null;
  const workspaceId = workspace?.id || null;
  const role = workspace?.role || null;

  // Compute effective permissions
  const fullAccess = isSuperAdmin || role === "admin";
  const permissions = workspace?.permissions || {};

  const hasPermission = (key: PermissionKey): boolean => {
    if (fullAccess) return true;
    // Always use explicit granular permissions for non-admin roles
    return !!permissions[key];
  };

  const setActiveWorkspace = (id: string) => {
    setActiveId(id);
    localStorage.setItem("active_workspace_id", id);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId,
        workspace,
        workspaces,
        role,
        isAdmin: role === "admin",
        isOperator: role === "operator",
        isViewer: role === "viewer",
        canWrite: role === "admin" || role === "operator",
        isSuperAdmin,
        permissions,
        hasPermission,
        setActiveWorkspace,
        isLoading: isSuperAdminLoading || isWorkspacesLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
