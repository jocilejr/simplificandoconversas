import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const location = useLocation();
  const isFullscreen = location.pathname === "/conversations";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center justify-between border-b border-border px-4 bg-card/50 backdrop-blur-sm">
            <SidebarTrigger />
            <ThemeToggle />
          </header>
          <main className={cn(
            "flex-1 overflow-hidden",
            isFullscreen ? "p-0" : "overflow-auto p-6"
          )}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
