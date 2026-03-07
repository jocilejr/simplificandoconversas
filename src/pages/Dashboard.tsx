import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, Bot, CalendarClock } from "lucide-react";

const stats = [
  { title: "Mensagens Enviadas", value: "1,234", icon: MessageSquare, change: "+12%" },
  { title: "Contatos Ativos", value: "856", icon: Users, change: "+5%" },
  { title: "Fluxos Ativos", value: "8", icon: Bot, change: "+2" },
  { title: "Agendamentos", value: "23", icon: CalendarClock, change: "3 hoje" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema de automação</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { text: "Mensagem enviada para +55 11 99999-0001", time: "2 min atrás" },
                { text: "Fluxo 'Boas-vindas' ativado", time: "15 min atrás" },
                { text: "3 novos contatos importados", time: "1h atrás" },
                { text: "Agendamento concluído: campanha Janeiro", time: "3h atrás" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm">{item.text}</span>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Atalhos Rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Nova Mensagem", icon: MessageSquare },
                { label: "Novo Contato", icon: Users },
                { label: "Novo Fluxo", icon: Bot },
                { label: "Agendar Envio", icon: CalendarClock },
              ].map((item) => (
                <button
                  key={item.label}
                  className="flex items-center gap-2 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
