import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
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
  setActiveWorkspace: () => {},
  isLoading: true,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(
    () => localStorage.getItem("active_workspace_id")
  );

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: members, error: mErr } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
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
        setActiveWorkspace,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
