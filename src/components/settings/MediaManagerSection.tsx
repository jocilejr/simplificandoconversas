import { useState, useEffect, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2, RefreshCw, FileAudio, FileImage, FileVideo, FileText, File, Loader2,
  Bot, Users, Receipt, Clock, LayoutGrid, ShieldCheck,
} from "lucide-react";

type FileSource = "flow" | "member" | "group" | "boleto" | "temporary";

interface MediaFile {
  name: string;
  relativePath: string;
  mime: string;
  category: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  modifiedAt: string;
  isTemporary: boolean;
  inUse: boolean;
  url: string;
  source: FileSource;
  ownerUserId: string;
}

const SOURCE_TABS: { key: FileSource | "all"; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "Todos", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { key: "flow", label: "Fluxos", icon: <Bot className="h-3.5 w-3.5" /> },
  { key: "member", label: "Membros", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { key: "group", label: "Grupos", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "boleto", label: "Boletos", icon: <Receipt className="h-3.5 w-3.5" /> },
  { key: "temporary", label: "Temporários", icon: <Clock className="h-3.5 w-3.5" /> },
];

const SOURCE_LABELS: Record<FileSource, { label: string; className: string }> = {
  flow: { label: "Fluxo", className: "border-blue-500 text-blue-600" },
  member: { label: "Membros", className: "border-green-500 text-green-600" },
  group: { label: "Grupo", className: "border-purple-500 text-purple-600" },
  boleto: { label: "Boleto", className: "border-amber-500 text-amber-600" },
  temporary: { label: "Temporário", className: "" },
};

const CATEGORY_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "audio", label: "Áudio" },
  { key: "image", label: "Imagem" },
  { key: "video", label: "Vídeo" },
  { key: "pdf", label: "PDF" },
  { key: "other", label: "Outro" },
];

/** Unique key for a file: ownerUserId + relativePath */
function fileKey(file: MediaFile): string {
  return `${file.ownerUserId}::${file.relativePath}`;
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "audio": return <FileAudio className="h-4 w-4 text-muted-foreground" />;
    case "image": return <FileImage className="h-4 w-4 text-muted-foreground" />;
    case "video": return <FileVideo className="h-4 w-4 text-muted-foreground" />;
    case "pdf": return <FileText className="h-4 w-4 text-muted-foreground" />;
    default: return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function FilePreview({ file, baseUrl }: { file: MediaFile; baseUrl: string }) {
  const fullUrl = `${baseUrl}${file.url}`;
  if (file.category === "image") {
    return <img src={fullUrl} alt={file.name} className="h-10 w-10 rounded object-cover border border-border" loading="lazy" />;
  }
  if (file.category === "audio") {
    return <audio src={fullUrl} controls preload="none" className="h-8 w-40" />;
  }
  if (file.category === "video") {
    return <video src={fullUrl} className="h-10 w-14 rounded object-cover border border-border" preload="none" />;
  }
  return <CategoryIcon category={file.category} />;
}

export function MediaManagerSection() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [totalSizeFormatted, setTotalSizeFormatted] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceTab, setSourceTab] = useState<FileSource | "all">("all");
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const baseUrl = supabaseUrl.includes(".supabase.co") ? "" : supabaseUrl.replace(/\/+$/, "").replace(/\/functions\/v1$/, "");

  const fetchFiles = useCallback(async () => {
    if (!user?.id || !workspaceId) return;
    setLoading(true);
    try {
      const resp = await fetch(apiUrl("media-manager/list"), {
        headers: { "x-user-id": user.id, "x-workspace-id": workspaceId },
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setFiles(data.files || []);
      setTotalSizeFormatted(data.totalSizeFormatted || "0 B");
    } catch (err: any) {
      toast.error("Erro ao carregar arquivos: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, workspaceId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: files.length, flow: 0, member: 0, group: 0, boleto: 0, temporary: 0 };
    for (const f of files) c[f.source] = (c[f.source] || 0) + 1;
    return c;
  }, [files]);

  const filtered = useMemo(() =>
    files.filter((f) => {
      if (sourceTab !== "all" && f.source !== sourceTab) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      return true;
    }),
  [files, sourceTab, categoryFilter]);

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => fileKey(f))));
  };

  const handleDelete = async () => {
    if (!user?.id || !workspaceId) return;
    setDeleting(true);
    try {
      // Build entries with ownerUserId + relativePath
      const entries = Array.from(selected).map((key) => {
        const file = files.find((f) => fileKey(f) === key);
        return file ? { ownerUserId: file.ownerUserId, relativePath: file.relativePath } : null;
      }).filter(Boolean);

      const resp = await fetch(apiUrl("media-manager/delete"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({ files: entries }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const result = await resp.json();
      toast.success(`${result.deleted} arquivo(s) deletado(s)`);
      setSelected(new Set());
      fetchFiles();
    } catch (err: any) {
      toast.error("Erro ao deletar: " + err.message);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const handleCleanup = async () => {
    if (!user?.id || !workspaceId) return;
    setCleaning(true);
    try {
      const resp = await fetch(apiUrl("media-manager/cleanup"), {
        method: "DELETE",
        headers: { "x-user-id": user.id, "x-workspace-id": workspaceId },
      });
      if (!resp.ok) throw new Error(await resp.text());
      const result = await resp.json();
      toast.success(`${result.deleted} arquivo(s) removido(s) • ${result.freedFormatted} liberado(s)`);
      fetchFiles();
    } catch (err: any) {
      toast.error("Erro ao limpar: " + err.message);
    } finally {
      setCleaning(false);
      setCleanupConfirmOpen(false);
    }
  };

  const selectedInUseCount = Array.from(selected).filter((key) =>
    files.find((f) => fileKey(f) === key)?.inUse
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gerenciador de Arquivos</h2>
          <p className="text-sm text-muted-foreground">
            {files.length} arquivo(s) • {totalSizeFormatted} total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Source Tabs */}
      <Tabs value={sourceTab} onValueChange={(v) => { setSourceTab(v as FileSource | "all"); setSelected(new Set()); }}>
        <TabsList className="h-10 bg-card border border-border/50 p-0.5 gap-0.5 flex-wrap">
          {SOURCE_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {tab.icon}
              {tab.label}
              <span className="ml-0.5 text-[10px] opacity-60">({counts[tab.key] || 0})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Type filter */}
        <div className="flex items-center gap-1 mt-3">
          <span className="text-xs text-muted-foreground mr-1">Tipo:</span>
          {CATEGORY_FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={categoryFilter === f.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setCategoryFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md flex-wrap mt-3">
          {selected.size > 0 && (
            <>
              <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
              <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Deletar selecionados
              </Button>
            </>
          )}
          {sourceTab === "temporary" && (
            <Button variant="outline" size="sm" onClick={() => setCleanupConfirmOpen(true)} disabled={cleaning}>
              {cleaning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Limpar temporários (+24h)
            </Button>
          )}
          {sourceTab !== "temporary" && sourceTab !== "all" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              Arquivos protegidos — não serão removidos pela limpeza automática
            </span>
          )}
        </div>

        {/* File table */}
        <div className="mt-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum arquivo encontrado</p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="w-16">Preview</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead className="w-20">Tamanho</TableHead>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead className="w-28">Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((file) => {
                    const sl = SOURCE_LABELS[file.source];
                    const fk = fileKey(file);
                    return (
                      <TableRow key={fk} className="cursor-pointer hover:bg-muted/50" onClick={() => setPreviewFile(file)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(fk)} onCheckedChange={() => toggleSelect(fk)} />
                        </TableCell>
                        <TableCell>
                          <FilePreview file={file} baseUrl={baseUrl} />
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono break-all">{file.name}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <CategoryIcon category={file.category} />
                            <span className="text-xs capitalize">{file.category}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{file.sizeFormatted}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(file.modifiedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {file.inUse && (
                              <Badge variant="default" className="text-[10px] w-fit">Em uso</Badge>
                            )}
                            <Badge
                              variant={file.source === "temporary" ? "secondary" : "outline"}
                              className={`text-[10px] w-fit ${sl.className}`}
                            >
                              {sl.label}
                              {file.source === "boleto" && " (30d)"}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Tabs>

      {/* Confirm delete dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {selected.size} arquivo(s)?
              {selectedInUseCount > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ {selectedInUseCount} arquivo(s) estão marcados como "Em uso" em fluxos, membros ou grupos.
                </span>
              )}
              <span className="block mt-1">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cleanup confirm dialog */}
      <AlertDialog open={cleanupConfirmOpen} onOpenChange={setCleanupConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar temporários</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai remover <strong>apenas arquivos temporários</strong> com mais de 24h.
              <span className="block mt-2 text-sm">
                ✅ Arquivos de <strong>fluxos</strong>, <strong>área de membros</strong> e <strong>grupos</strong> são protegidos e <strong>nunca</strong> serão removidos.
              </span>
              <span className="block mt-1">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} className="bg-destructive text-destructive-foreground">
              {cleaning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono break-all">{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && (() => {
            const fullUrl = `${baseUrl}${previewFile.url}`;
            const sl = SOURCE_LABELS[previewFile.source];
            return (
              <div className="space-y-4">
                {/* Metadata */}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{previewFile.sizeFormatted}</span>
                  <span>•</span>
                  <span className="capitalize">{previewFile.category}</span>
                  <span>•</span>
                  <span>{new Date(previewFile.modifiedAt).toLocaleDateString("pt-BR")}</span>
                  <span>•</span>
                  <Badge variant={previewFile.source === "temporary" ? "secondary" : "outline"} className={`text-[10px] ${sl.className}`}>
                    {sl.label}
                  </Badge>
                  {previewFile.inUse && <Badge variant="default" className="text-[10px]">Em uso</Badge>}
                </div>

                {/* Content preview */}
                <div className="flex items-center justify-center bg-muted/30 rounded-lg p-4 min-h-[200px]">
                  {previewFile.category === "image" && (
                    <img src={fullUrl} alt={previewFile.name} className="max-w-full max-h-[65vh] rounded object-contain" />
                  )}
                  {previewFile.category === "audio" && (
                    <audio src={fullUrl} controls className="w-full max-w-md" />
                  )}
                  {previewFile.category === "video" && (
                    <video src={fullUrl} controls className="max-w-full max-h-[65vh] rounded" />
                  )}
                  {previewFile.category === "pdf" && (
                    <iframe src={fullUrl} className="w-full h-[65vh] rounded border border-border" title={previewFile.name} />
                  )}
                  {!["image", "audio", "video", "pdf"].includes(previewFile.category) && (
                    <div className="text-center space-y-2">
                      <File className="h-16 w-16 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Preview não disponível para este tipo de arquivo</p>
                      <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                        Abrir em nova aba
                      </a>
                    </div>
                  )}
                </div>

                {/* Open in new tab */}
                {["image", "audio", "video", "pdf"].includes(previewFile.category) && (
                  <div className="text-center">
                    <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                      Abrir em nova aba ↗
                    </a>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
