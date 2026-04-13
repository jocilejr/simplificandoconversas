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

interface BackupSummary {
  version: number;
  campaigns: any[];
  scheduledMessages: any[];
  mediaKeys: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  summary: BackupSummary | null;
  file: File | null;
}

interface ImportResult {
  campaignsImported: number;
  messagesImported: number;
  mediaUploaded: number;
  mediaFailed: number;
}

export default function GroupImportDialog({ open, onOpenChange, summary, file }: Props) {
  const { workspaceId } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [stage, setStage] = useState<"idle" | "data" | "media" | "remap" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!summary) return null;

  const campaigns = summary.campaigns;
  const messages = summary.scheduledMessages;
  const mediaCount = summary.mediaKeys.length;

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResult(null);
    setStage("data");
    setProgress(0);
    setProgressLabel("Importando campanhas e mensagens...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // ── Etapa 1: Enviar apenas dados (sem mídia) ──
      const backupWithoutMedia = {
        version: summary.version,
        data: {
          campaigns: summary.campaigns,
          scheduled_messages: summary.scheduledMessages,
        },
      };

      const resp = await fetch(apiUrl("groups/import-backup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          userId: user.id,
          backup: backupWithoutMedia,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText);
      }

      const data = await resp.json();
      const messageIds: string[] = data.messageIds || [];
      let mediaUploaded = 0;
      let mediaFailed = 0;

      // ── Etapa 2: Upload de mídias uma a uma ──
      if (mediaCount > 0 && file) {
        setStage("media");
        setProgressLabel("Lendo mídias do arquivo...");

        // Re-read the file to extract media section
        const fullText = await file.text();
        const parsed = JSON.parse(fullText);
        const media = parsed.media || {};
        const mediaEntries = Object.entries(media);
        const mediaUrlMap: Record<string, string> = {};

        for (let i = 0; i < mediaEntries.length; i++) {
          const [path, dataUri] = mediaEntries[i];
          setProgress(Math.round(((i + 1) / mediaEntries.length) * 100));
          setProgressLabel(`Enviando mídia ${i + 1} de ${mediaEntries.length}...`);

          try {
            const mediaResp = await fetch(apiUrl("groups/import-media"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                workspaceId,
                userId: user.id,
                path,
                dataUri,
              }),
            });

            if (mediaResp.ok) {
              const mediaData = await mediaResp.json();
              mediaUrlMap[mediaData.oldPath] = mediaData.newUrl;
              mediaUploaded++;
            } else {
              console.warn(`[import] Failed to upload media ${path}`);
              mediaFailed++;
            }
          } catch (e: any) {
            console.warn(`[import] Media upload error for ${path}:`, e.message);
            mediaFailed++;
          }
        }

        // ── Etapa 3: Remapear URLs nas mensagens ──
        if (Object.keys(mediaUrlMap).length > 0 && messageIds.length > 0) {
          setStage("remap");
          setProgressLabel("Atualizando referências de mídia...");
          setProgress(0);

          try {
            await fetch(apiUrl("groups/import-remap-media"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                workspaceId,
                messageIds,
                mediaUrlMap,
              }),
            });
          } catch (e: any) {
            console.warn("[import] Remap error:", e.message);
          }
        }
      }

      setStage("done");
      setProgress(100);
      const finalResult: ImportResult = {
        campaignsImported: data.campaignsImported,
        messagesImported: data.messagesImported,
        mediaUploaded,
        mediaFailed,
      };
      setResult(finalResult);
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
    setStage("idle");
    setProgress(0);
    setProgressLabel("");
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
              {mediaCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  As mídias serão enviadas individualmente após a criação das campanhas.
                </p>
              )}
            </div>

            {importing && (
              <div className="space-y-2">
                <Progress value={stage === "data" ? undefined : progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{progressLabel}</p>
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
              {result.mediaFailed > 0 && (
                <li className="text-destructive">{result.mediaFailed} mídias falharam</li>
              )}
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
