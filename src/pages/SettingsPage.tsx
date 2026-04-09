import { useProfile } from "@/hooks/useProfile";
import { User, Plug, Brain, Code, Mail, AppWindow, Puzzle, Users, Percent, Crown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { ConnectionsSection } from "@/components/settings/ConnectionsSection";
import { AISection } from "@/components/settings/AISection";
import { AppSection } from "@/components/settings/AppSection";
import { IntegrationApiSection } from "@/components/settings/IntegrationApiSection";
import { EmailSettingsSection } from "@/components/settings/EmailSettingsSection";
import { IntegrationsSection } from "@/components/settings/IntegrationsSection";
import { TeamSection } from "@/components/settings/TeamSection";
import { FeesSection } from "@/components/settings/FeesSection";
import { MemberAreaSettingsSection } from "@/components/settings/MemberAreaSettingsSection";
import { useWorkspace } from "@/hooks/useWorkspace";

const allSections = [
  { key: "profile", label: "Perfil", icon: User, minRole: "viewer" },
  { key: "team", label: "Equipe", icon: Users, minRole: "admin" },
  { key: "connections", label: "Conexões", icon: Plug, minRole: "admin" },
  { key: "integrations", label: "Integrações", icon: Puzzle, minRole: "admin" },
  { key: "ai", label: "IA", icon: Brain, minRole: "admin" },
  { key: "api", label: "API", icon: Code, minRole: "admin" },
  { key: "email", label: "E-mail", icon: Mail, minRole: "operator" },
  { key: "fees", label: "Taxas", icon: Percent, minRole: "admin" },
  { key: "member_area", label: "Área de Membros", icon: Crown, minRole: "admin" },
  { key: "app", label: "Aplicação", icon: AppWindow, minRole: "admin" },
];

const SettingsPage = () => {
  useProfile(); // preload
  const { role, isSuperAdmin } = useWorkspace();
  const [active, setActive] = useState("profile");

  const roleLevel = (r: string) => r === "admin" ? 3 : r === "operator" ? 2 : 1;
  const userLevel = isSuperAdmin ? 99 : roleLevel(role || "viewer");
  const sections = allSections.filter((s) => userLevel >= roleLevel(s.minRole));


  const renderContent = () => {
    switch (active) {
      case "profile": return <ProfileSection />;
      case "team": return <TeamSection />;
      case "connections": return <ConnectionsSection />;
      case "integrations": return <IntegrationsSection />;
      case "ai": return <AISection />;
      case "api": return <IntegrationApiSection />;
      case "email": return <EmailSettingsSection />;
      case "fees": return <FeesSection />;
      case "member_area": return <MemberAreaSettingsSection />;
      case "app": return <AppSection />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas preferências e conexões</p>
      </div>

      <div className="flex gap-6">
        {/* Navegação lateral */}
        <nav className="w-48 shrink-0 space-y-0.5">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={cn(
                "flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs font-medium transition-colors text-left",
                active === s.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
