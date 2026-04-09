import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Activity, Clock, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInMinutes, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MemberSession {
  id: string;
  normalized_phone: string;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  current_activity: string;
  current_product_name: string | null;
  current_material_name: string | null;
}

interface MemberSummary {
  key: string;
  phone: string;
  name: string | null;
  isOnline: boolean;
  latestActivity: string;
  latestProductName: string | null;
  latestMaterialName: string | null;
  firstAccess: string;
  lastAccess: string;
  totalMinutes: number;
  totalSessions: number;
}

const ACTIVITY_LABELS: Record<string, string> = {
  viewing_home: "Na página inicial",
  viewing_product: "Visualizando produto",
  reading_pdf: "Lendo PDF",
  watching_video: "Assistindo vídeo",
  viewing_offer: "Visualizando oferta",
};

function getActivityLabel(summary: MemberSummary): string {
  const base = ACTIVITY_LABELS[summary.latestActivity] || summary.latestActivity || "Navegando";
  if (summary.latestMaterialName) return `${base} — ${summary.latestMaterialName}`;
  if (summary.latestProductName) return `${base} — ${summary.latestProductName}`;
  return base;
}

function isSessionOnline(session: MemberSession): boolean {
  if (session.ended_at) return false;
  return differenceInSeconds(new Date(), new Date(session.last_heartbeat_at)) < 90;
}

function getSessionDurationMins(session: MemberSession): number {
  const end = session.ended_at
    ? new Date(session.ended_at)
    : differenceInSeconds(new Date(), new Date(session.last_heartbeat_at)) > 90
      ? new Date(session.last_heartbeat_at)
      : new Date();
  return Math.max(0, differenceInMinutes(end, new Date(session.started_at)));
}

function formatDuration(mins: number): string {
  if (mins < 1) return "< 1min";
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function phoneGroupKey(phone: string): string {
  return phone.replace(/\D/g, "").slice(-8);
}

export default function MemberActivityTab() {
  const { workspaceId } = useWorkspace();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const { data: sessions, refetch } = useQuery({
    queryKey: ["member-sessions-recent", workspaceId],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from("member_sessions" as any)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200);
      return (data || []) as MemberSession[];
    },
    enabled: !!workspaceId,
    refetchInterval: 30_000,
  });

  // Get names from conversations
  const uniquePhones = useMemo(() => {
    if (!sessions) return [];
    return [...new Set(sessions.map(s => s.normalized_phone))];
  }, [sessions]);

  const { data: contactNames } = useQuery({
    queryKey: ["session-contact-names", uniquePhones, workspaceId],
    queryFn: async () => {
      if (!uniquePhones.length || !workspaceId) return {};
      const last8s = uniquePhones.map(p => p.replace(/\D/g, "").slice(-8));
      const { data } = await supabase
        .from("conversations")
        .select("phone_number, contact_name")
        .eq("workspace_id", workspaceId)
        .not("contact_name", "is", null);
      if (!data) return {};
      const map: Record<string, string> = {};
      for (const phone of uniquePhones) {
        const last8 = phone.replace(/\D/g, "").slice(-8);
        const match = data.find((c: any) => c.phone_number && c.phone_number.replace(/\D/g, "").slice(-8) === last8);
        if (match?.contact_name) map[phone] = match.contact_name;
      }
      return map;
    },
    enabled: uniquePhones.length > 0 && !!workspaceId,
  });

  const memberSummaries = useMemo((): MemberSummary[] => {
    if (!sessions?.length) return [];
    const groups = new Map<string, MemberSession[]>();
    for (const s of sessions) {
      const key = phoneGroupKey(s.normalized_phone);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    const summaries: MemberSummary[] = [];
    for (const [key, memberSessions] of groups) {
      const sorted = [...memberSessions].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      const latest = sorted[0];
      const oldest = sorted[sorted.length - 1];
      const online = sorted.some(isSessionOnline);
      const latestOnline = online ? sorted.find(isSessionOnline)! : latest;
      const totalMins = sorted.reduce((sum, s) => sum + getSessionDurationMins(s), 0);
      const name = sorted.map(s => contactNames?.[s.normalized_phone]).find(Boolean) || null;
      const lastAccessDate = sorted.reduce((max, s) => Math.max(max, new Date(s.last_heartbeat_at).getTime()), 0);

      summaries.push({
        key, phone: latest.normalized_phone, name, isOnline: online,
        latestActivity: latestOnline.current_activity,
        latestProductName: latestOnline.current_product_name,
        latestMaterialName: latestOnline.current_material_name,
        firstAccess: oldest.started_at,
        lastAccess: new Date(lastAccessDate).toISOString(),
        totalMinutes: totalMins, totalSessions: sorted.length,
      });
    }
    summaries.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime();
    });
    return summaries;
  }, [sessions, contactNames, now]);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel("member-sessions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member_sessions" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const onlineCount = memberSummaries.filter(m => m.isOnline).length;
  const avgDurationMins = useMemo(() => {
    const withTime = memberSummaries.filter(m => m.totalMinutes > 0);
    if (!withTime.length) return 0;
    return Math.round(withTime.reduce((sum, m) => sum + m.totalMinutes, 0) / withTime.length);
  }, [memberSummaries]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            <p className="text-2xl font-bold text-primary">{onlineCount}</p>
          </div>
          <p className="text-xs text-muted-foreground">Online agora</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{memberSummaries.length}</p>
          <p className="text-xs text-muted-foreground">Visitantes (24h)</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{sessions?.length || 0}</p>
          <p className="text-xs text-muted-foreground">Sessões (24h)</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-2xl font-bold text-foreground">{avgDurationMins}min</p>
          <p className="text-xs text-muted-foreground">Tempo médio</p>
        </Card>
      </div>

      {/* Online Members */}
      {onlineCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Wifi className="h-4 w-4 text-primary" /> Membros Online
            </h3>
            <div className="space-y-2">
              {memberSummaries.filter(m => m.isOnline).map((member) => (
                <div key={member.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{member.name || member.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">{getActivityLabel(member)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{formatDuration(member.totalMinutes)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Table */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" /> Membros (24h)
          </h3>
          {!memberSummaries.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma sessão registrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Atividade</TableHead>
                    <TableHead>Primeiro Acesso</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Tempo Total</TableHead>
                    <TableHead className="text-center">Acessos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberSummaries.map((member) => (
                    <TableRow key={member.key}>
                      <TableCell className="font-medium text-sm">{member.name || member.phone}</TableCell>
                      <TableCell>
                        {member.isOnline ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />Online</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" />Offline</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{getActivityLabel(member)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(member.firstAccess), "HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(member.lastAccess), "HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDuration(member.totalMinutes)}</TableCell>
                      <TableCell className="text-center"><span className="text-sm font-semibold">{member.totalSessions}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
