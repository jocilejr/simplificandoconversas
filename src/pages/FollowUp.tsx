import { FollowUpDashboard } from "@/components/followup/FollowUpDashboard";

export default function FollowUp() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Follow Up</h1>
        <p className="text-muted-foreground text-sm">Recuperação de boletos pendentes e vencidos</p>
      </div>
      <FollowUpDashboard />
    </div>
  );
}
