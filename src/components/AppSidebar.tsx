import {
  LayoutDashboard,
  Users,
  Workflow,
  Settings,
  LogOut,
  Send,
  Bell,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ManualFlowTrigger } from "@/components/ManualFlowTrigger";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;
  
  const [triggerOpen, setTriggerOpen] = useState(false);
  const { user } = useAuth();
  const { profile } = useProfile();



  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Usuário";
  const initials = displayName.slice(0, 2).toUpperCase();

  const mainItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Contatos", url: "/contacts", icon: Users },
    { title: "Fluxos", url: "/chatbot", icon: Workflow },
    { title: "Lembretes", url: "/reminders", icon: Bell },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <img src="/images/logo-ov.png" alt="Origem Viva" className="h-9 w-9 shrink-0 rounded-xl" />
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground leading-tight">
              Chatbot Interno<br />Origem Viva
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="h-10 rounded-lg transition-all duration-200"
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/80"
                      activeClassName="bg-sidebar-accent text-primary font-medium shadow-sm"
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2 opacity-50" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-10 rounded-lg transition-all duration-200 cursor-pointer hover:bg-sidebar-accent/80"
                  onClick={() => setTriggerOpen(true)}
                >
                  <Send className="h-5 w-5" />
                  {!collapsed && <span className="text-sm">Disparar Fluxo</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings")}
                  className="h-10 rounded-lg transition-all duration-200"
                >
                  <NavLink
                    to="/settings"
                    end
                    className="hover:bg-sidebar-accent/80"
                    activeClassName="bg-sidebar-accent text-primary font-medium shadow-sm"
                  >
                    <Settings className="h-5 w-5" />
                    {!collapsed && <span className="text-sm">Configurações</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className={`flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3 ${collapsed ? "justify-center" : ""}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
      <ManualFlowTrigger open={triggerOpen} onOpenChange={setTriggerOpen} />
    </Sidebar>
  );
}
