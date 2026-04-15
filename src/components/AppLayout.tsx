import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTransactionNotifications } from "@/hooks/useTransactionNotifications";
import { NotificationPopup } from "@/components/layout/NotificationPopup";

import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const location = useLocation();
  const isFullscreen = location.pathname === "/conversations";
  const { notifications, dismissAll, dismissOne } = useTransactionNotifications();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full min-w-0 overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="h-12 flex items-center justify-between border-b border-border px-4 bg-card/50 backdrop-blur-sm">
            <SidebarTrigger />
            <NotificationPopup
              notifications={notifications}
              onDismissAll={dismissAll}
              onDismissOne={dismissOne}
            />
          </header>
          <main className={cn(
            "min-w-0 flex-1 overflow-hidden",
            isFullscreen ? "p-0" : "overflow-x-hidden overflow-y-auto p-6"
          )}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
