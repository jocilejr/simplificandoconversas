import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, AlertCircle, FileJson } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface BackupData {
  version: number;
  data: {
    campaigns?: any[];
    scheduled_messages?: any[];
    [key: string]: any;
  };
  media?: Record<string, string>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  backupData: BackupData | null;
}

export default function GroupImportDialog({ open, onOpenChange, backupData }: Props) {
  const { workspaceId } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ campaignsImported: number; messagesImported: number; mediaUploaded: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!backupData) return null;

  const campaigns = backupData.data?.campaigns || [];
  const messages = backupData.data?.scheduled_messages || [];
  const mediaCount = Object.keys(backupData.media || {}).length;

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const resp = await fetch(apiUrl("groups/import-backup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          userId: user.id,
          backup: backupData,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText);
      }

      const data = await resp.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["group-campaigns"] });
      toast({ title: `${data.campaignsImported} campanhas importadas!` });
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Importar Backup
          </DialogTitle>
          <DialogDescription>
            Importe campanhas e mensagens de um arquivo de backup externo.
          </DialogDescription>
        </DialogHeader>

        {!result && !error && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 p-4 space-y-2">
              <h4 className="text-sm font-medium">Resumo do arquivo</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-lg font-bold">{campaigns.length}</p>
                  <p className="text-xs text-muted-foreground">Campanhas</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-lg font-bold">{messages.length}</p>
                  <p className="text-xs text-muted-foreground">Mensagens</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-lg font-bold">{mediaCount}</p>
                  <p className="text-xs text-muted-foreground">Mídias</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                As campanhas serão importadas como <strong>inativas</strong>. Ative-as após configurar a instância.
              </p>
            </div>

            {importing && (
              <div className="space-y-2">
                <Progress value={undefined} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">Importando...</p>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <h4 className="font-medium text-sm">Importação concluída!</h4>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 ml-7">
              <li>{result.campaignsImported} campanhas importadas</li>
              <li>{result.messagesImported} mensagens agendadas</li>
              <li>{result.mediaUploaded} mídias enviadas</li>
            </ul>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <h4 className="font-medium text-sm">Erro na importação</h4>
            </div>
            <p className="text-xs text-muted-foreground ml-7">{error}</p>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={importing}>Cancelar</Button>
              <Button onClick={handleImport} disabled={importing} className="gap-1.5">
                <Upload className="h-4 w-4" />
                {importing ? "Importando..." : "Importar"}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
