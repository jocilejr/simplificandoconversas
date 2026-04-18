import {
  LayoutDashboard,
  Users,
  Workflow,
  Settings,
  LogOut,
  Send,
  Bell,
  Mail,
  Receipt,
  RefreshCw,
  FileText,
  BarChart3,
  UsersRound,
  Crown,
  Package,
  LinkIcon,
  PhoneForwarded,
  MessageSquareText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ManualFlowTrigger } from "@/components/ManualFlowTrigger";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useWorkspace, PermissionKey } from "@/hooks/useWorkspace";
import { useUnseenTransactions } from "@/hooks/useUnseenTransactions";
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

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  permKey: PermissionKey;
}

const financeItems: MenuItem[] = [
  { title: "Relatório", url: "/relatorio", icon: BarChart3, permKey: "relatorio" },
  { title: "Leads", url: "/leads", icon: Users, permKey: "leads" },
  { title: "Transações", url: "/transacoes", icon: Receipt, permKey: "transacoes" },
  { title: "Gerar Boleto", url: "/gerar-boleto", icon: FileText, permKey: "gerar_boleto" },
  { title: "Área de Membros", url: "/area-membros", icon: Crown, permKey: "area_membros" },
  { title: "Entrega Digital", url: "/entrega", icon: Package, permKey: "entrega" },
  { title: "Follow Up", url: "/follow-up", icon: PhoneForwarded, permKey: "recuperacao" },
];

const operationalItems: MenuItem[] = [
  { title: "Fluxos", url: "/chatbot", icon: Workflow, permKey: "chatbot" },
  { title: "E-mail", url: "/email", icon: Mail, permKey: "email" },
  { title: "Lembretes", url: "/reminders", icon: Bell, permKey: "reminders" },
  { title: "Grupos", url: "/grupos", icon: UsersRound, permKey: "grupos" },
  { title: "Links Úteis", url: "/links-uteis", icon: LinkIcon, permKey: "links_uteis" },
  { title: "Respostas Rápidas", url: "/respostas-rapidas", icon: MessageSquareText, permKey: "respostas_rapidas" },
];

function MenuGroup({ label, items, collapsed, isActive, dotUrls }: {
  label: string;
  items: MenuItem[];
  collapsed: boolean;
  isActive: (path: string) => boolean;
  dotUrls?: Set<string>;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-0.5 px-2">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                className="h-8 rounded-md transition-colors"
              >
                <NavLink
                  to={item.url}
                  end
                  className="hover:bg-sidebar-accent/80 relative"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span className="text-xs">{item.title}</span>}
                  {dotUrls?.has(item.url) && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  const [triggerOpen, setTriggerOpen] = useState(false);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { hasPermission } = useWorkspace();
  const { hasAnyUnseen } = useUnseenTransactions();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Usuário";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Filter menu items by permissions
  const visibleFinance = financeItems.filter((i) => hasPermission(i.permKey));
  const visibleOperational = operationalItems.filter((i) => hasPermission(i.permKey));
  const canTriggerFlow = hasPermission("disparar_fluxo");
  const canSettings = hasPermission("settings");

  const financeDotUrls = useMemo(() => {
    const set = new Set<string>();
    if (hasAnyUnseen()) set.add("/transacoes");
    return set;
  }, [hasAnyUnseen]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <img src="/images/logo-ov.png" alt="Origem Viva" className="h-7 w-7 shrink-0 rounded-lg" />
          {!collapsed && (
            <span className="text-xs font-semibold tracking-tight text-sidebar-foreground leading-tight">
              Chatbot Interno<br />Origem Viva
            </span>
          )}
        </div>
        <WorkspaceSwitcher collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent className="px-2">
        {visibleFinance.length > 0 && (
          <MenuGroup label="Financeiro" items={visibleFinance} collapsed={collapsed} isActive={isActive} dotUrls={financeDotUrls} />
        )}

        {visibleOperational.length > 0 && (
          <>
            <Separator className="my-1 opacity-40" />
            <MenuGroup label="Operacional" items={visibleOperational} collapsed={collapsed} isActive={isActive} />
          </>
        )}

        {(canTriggerFlow || canSettings) && (
          <>
            <Separator className="my-1 opacity-40" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-0.5 px-2">
                Sistema
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {canTriggerFlow && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="h-8 rounded-md transition-colors cursor-pointer hover:bg-sidebar-accent/80"
                        onClick={() => setTriggerOpen(true)}
                      >
                        <Send className="h-4 w-4" />
                        {!collapsed && <span className="text-xs">Disparar Fluxo</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {canSettings && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/settings")}
                        className="h-8 rounded-md transition-colors"
                      >
                        <NavLink
                          to="/settings"
                          end
                          className="hover:bg-sidebar-accent/80"
                          activeClassName="bg-sidebar-accent text-primary font-medium"
                        >
                          <Settings className="h-4 w-4" />
                          {!collapsed && <span className="text-xs">Configurações</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <div className={`flex items-center gap-2 rounded-lg bg-sidebar-accent/60 p-2 ${collapsed ? "justify-center" : ""}`}>
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-sidebar-foreground truncate">{displayName}</p>
                <p className="text-[9px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
      <ManualFlowTrigger open={triggerOpen} onOpenChange={setTriggerOpen} />
    </Sidebar>
  );
}
