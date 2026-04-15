import { useWorkspace, PermissionKey } from "@/hooks/useWorkspace";
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface PermissionGateProps {
  permission: PermissionKey;
  children: ReactNode;
  redirect?: boolean;
}

/**
 * Blocks rendering if user lacks the given permission.
 * If redirect=true, navigates to /dashboard. Otherwise renders nothing.
 */
export function PermissionGate({ permission, children, redirect = false }: PermissionGateProps) {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission(permission)) {
    return redirect ? <Navigate to="/" replace /> : null;
  }
  return <>{children}</>;
}
