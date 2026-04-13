import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { PermissionGate } from "@/components/PermissionGate";
import Auth from "./pages/Auth";
import SmartLinkRedirect from "./pages/SmartLinkRedirect";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import ChatbotBuilder from "./pages/ChatbotBuilder";
import SettingsPage from "./pages/SettingsPage";
import Reminders from "./pages/Reminders";
import EmailPage from "./pages/EmailPage";
import LinkRedirect from "./pages/LinkRedirect";
import MemberAccess from "./pages/MemberAccess";
import NotFound from "./pages/NotFound";
import Transacoes from "./pages/Transacoes";
import RelatorioFinanceiro from "./pages/RelatorioFinanceiro";

import GerarBoleto from "./pages/GerarBoleto";
import GruposPage from "./pages/GruposPage";
import AreaMembros from "./pages/AreaMembros";
import EntregaDigital from "./pages/EntregaDigital";
import LinksUteis from "./pages/LinksUteis";
import FollowUp from "./pages/FollowUp";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WorkspaceProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/r/g/:slug" element={<SmartLinkRedirect />} />
            <Route path="/r/:code" element={<LinkRedirect />} />
             <Route path="/a/entrega/:phone" element={<MemberAccess />} />
             <Route path="/membros/:phone" element={<MemberAccess />} />
             <Route path="/:phone" element={<MemberAccess />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<PermissionGate permission="dashboard" redirect><Dashboard /></PermissionGate>} />
                <Route path="/leads" element={<PermissionGate permission="leads" redirect><Leads /></PermissionGate>} />
                <Route path="/contacts" element={<Navigate to="/leads" replace />} />
                <Route path="/clientes-financeiro" element={<Navigate to="/leads" replace />} />
                <Route path="/schedule" element={<Navigate to="/reminders" replace />} />
                <Route path="/chatbot" element={<PermissionGate permission="chatbot" redirect><ChatbotBuilder /></PermissionGate>} />
                <Route path="/email" element={<PermissionGate permission="email" redirect><EmailPage /></PermissionGate>} />
                <Route path="/reminders" element={<PermissionGate permission="reminders" redirect><Reminders /></PermissionGate>} />
                <Route path="/settings" element={<PermissionGate permission="settings" redirect><SettingsPage /></PermissionGate>} />
                <Route path="/transacoes" element={<PermissionGate permission="transacoes" redirect><Transacoes /></PermissionGate>} />
                <Route path="/relatorio" element={<PermissionGate permission="relatorio" redirect><RelatorioFinanceiro /></PermissionGate>} />
                <Route path="/recuperacao" element={<Navigate to="/transacoes" replace />} />
                <Route path="/gerar-boleto" element={<PermissionGate permission="gerar_boleto" redirect><GerarBoleto /></PermissionGate>} />
                <Route path="/grupos" element={<PermissionGate permission="grupos" redirect><GruposPage /></PermissionGate>} />
                <Route path="/area-membros" element={<PermissionGate permission="area_membros" redirect><AreaMembros /></PermissionGate>} />
                <Route path="/entrega" element={<PermissionGate permission="entrega" redirect><EntregaDigital /></PermissionGate>} />
                <Route path="/links-uteis" element={<PermissionGate permission="links_uteis" redirect><LinksUteis /></PermissionGate>} />
                <Route path="/follow-up" element={<PermissionGate permission="recuperacao" redirect><FollowUp /></PermissionGate>} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WorkspaceProvider>
  </QueryClientProvider>
);

export default App;
