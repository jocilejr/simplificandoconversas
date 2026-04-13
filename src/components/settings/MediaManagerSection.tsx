import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw, FileAudio, FileImage, FileVideo, FileText, File, Loader2 } from "lucide-react";

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
}

const CATEGORY_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "audio", label: "Áudio" },
  { key: "image", label: "Imagem" },
  { key: "video", label: "Vídeo" },
  { key: "pdf", label: "PDF" },
  { key: "other", label: "Outro" },
];

const LOCATION_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "permanent", label: "Permanentes" },
  { key: "temporary", label: "Temporários" },
];

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
    return (
      <img
        src={fullUrl}
        alt={file.name}
        className="h-10 w-10 rounded object-cover border border-border"
        loading="lazy"
      />
    );
  }

  if (file.category === "audio") {
    return <audio src={fullUrl} controls preload="none" className="h-8 w-40" />;
  }

  if (file.category === "video") {
    return (
      <video
        src={fullUrl}
        className="h-10 w-14 rounded object-cover border border-border"
        preload="none"
      />
    );
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
  const [locationFilter, setLocationFilter] = useState("all");
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const baseUrl = supabaseUrl.includes(".supabase.co") ? "" : supabaseUrl.replace(/\/+$/, "").replace(/\/functions\/v1$/, "");

  const fetchFiles = useCallback(async () => {
    if (!user?.id || !workspaceId) return;
    setLoading(true);
    try {
      const resp = await fetch(apiUrl("media-manager/list"), {
        headers: {
          "x-user-id": user.id,
          "x-workspace-id": workspaceId,
        },
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

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filtered = files.filter((f) => {
    if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
    if (locationFilter === "permanent" && f.isTemporary) return false;
    if (locationFilter === "temporary" && !f.isTemporary) return false;
    return true;
  });

  const toggleSelect = (relPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((f) => f.relativePath)));
    }
  };

  const handleDelete = async () => {
    if (!user?.id) return;
    setDeleting(true);
    try {
      const resp = await fetch(apiUrl("media-manager/delete"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ files: Array.from(selected) }),
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

  const selectedInUseCount = Array.from(selected).filter((p) =>
    files.find((f) => f.relativePath === p)?.inUse
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-1">
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
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Local:</span>
          {LOCATION_FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={locationFilter === f.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setLocationFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 p-2 bg-muted rounded-md flex-wrap">
        {selected.size > 0 && (
          <>
            <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Deletar selecionados
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCleanupConfirmOpen(true)}
          disabled={cleaning}
        >
          {cleaning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
          Limpar temporários (+24h)
        </Button>
      </div>

      {/* Table */}
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
                  <Checkbox
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-16">Preview</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-20">Tipo</TableHead>
                <TableHead className="w-20">Tamanho</TableHead>
                <TableHead className="w-28">Data</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((file) => (
                <TableRow key={file.relativePath}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(file.relativePath)}
                      onCheckedChange={() => toggleSelect(file.relativePath)}
                    />
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
                        variant={file.isTemporary ? "secondary" : "outline"}
                        className="text-[10px] w-fit"
                      >
                        {file.isTemporary ? "Temporário" : "Permanente"}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {selected.size} arquivo(s)?
              {selectedInUseCount > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ {selectedInUseCount} arquivo(s) estão marcados como "Em uso" em fluxos ou campanhas.
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
    </div>
  );
}
