import { useWorkspace } from "@/hooks/useWorkspace";
import { ReactNode } from "react";

interface RoleGateProps {
  /** Minimum role required: admin > operator > viewer */
  allowedRoles: ("admin" | "operator" | "viewer")[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ allowedRoles, children, fallback = null }: RoleGateProps) {
  const { role } = useWorkspace();
  if (!role || !allowedRoles.includes(role as any)) return <>{fallback}</>;
  return <>{children}</>;
}
