import { toast } from "sonner";

export interface FlowExportData {
  version: 1;
  exportedAt: string;
  name: string;
  instanceNames: string[];
  nodes: any[];
  edges: any[];
  media: Record<string, string>; // url -> data:mime;base64,...
}

const MEDIA_FIELDS = ["audioUrl", "mediaUrl", "fileUrl", "clickPreviewImage"] as const;

/** Extract all media URLs from nodes (including steps inside groupBlocks) */
export function extractMediaUrls(nodes: any[]): string[] {
  const urls = new Set<string>();

  const collectFromData = (data: any) => {
    if (!data) return;
    for (const field of MEDIA_FIELDS) {
      const val = data[field];
      if (val && typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"))) {
        urls.add(val);
      }
    }
  };

  for (const node of nodes) {
    collectFromData(node.data);
    // groupBlock steps
    if (node.data?.steps && Array.isArray(node.data.steps)) {
      for (const step of node.data.steps) {
        collectFromData(step.data);
      }
    }
  }

  return Array.from(urls);
}

/** Fetch a URL and return as data URI (base64) */
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Export a flow to a downloadable JSON file */
export async function exportFlow(flow: {
  name: string;
  nodes: any[];
  edges: any[];
  instance_names?: string[];
}): Promise<void> {
  const toastId = toast.loading("Exportando fluxo...");

  try {
    const urls = extractMediaUrls(flow.nodes);
    const media: Record<string, string> = {};
    let failedCount = 0;

    // Fetch all media in parallel (batches of 5)
    for (let i = 0; i < urls.length; i += 5) {
      const batch = urls.slice(i, i + 5);
      const results = await Promise.all(batch.map(urlToBase64));
      batch.forEach((url, idx) => {
        if (results[idx]) {
          media[url] = results[idx]!;
        } else {
          failedCount++;
        }
      });
    }

    const exportData: FlowExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      name: flow.name,
      instanceNames: flow.instance_names || [],
      nodes: flow.nodes,
      edges: flow.edges,
      media,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (failedCount > 0) {
      toast.warning(`Exportado com ${failedCount} mídia(s) não encontrada(s)`, { id: toastId });
    } else {
      toast.success(`Fluxo exportado com ${Object.keys(media).length} mídia(s)`, { id: toastId });
    }
  } catch (err) {
    console.error("Export error:", err);
    toast.error("Erro ao exportar fluxo", { id: toastId });
  }
}

/** Replace old media URLs with new ones in nodes (including groupBlock steps) */
function replaceMediaUrls(nodes: any[], urlMap: Record<string, string>): any[] {
  const replaceInData = (data: any) => {
    if (!data) return data;
    const updated = { ...data };
    for (const field of MEDIA_FIELDS) {
      if (updated[field] && urlMap[updated[field]]) {
        updated[field] = urlMap[updated[field]];
      }
    }
    if (updated.steps && Array.isArray(updated.steps)) {
      updated.steps = updated.steps.map((s: any) => ({
        ...s,
        data: replaceInData(s.data),
      }));
    }
    return updated;
  };

  return nodes.map((n) => ({
    ...n,
    data: replaceInData(n.data),
  }));
}

/** Convert base64 data URI to a File object */
function dataUriToFile(dataUri: string, filename: string): File {
  const [header, base64] = dataUri.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

/** Validate import file structure */
export function validateImportFile(data: any): data is FlowExportData {
  return (
    data &&
    data.version === 1 &&
    typeof data.name === "string" &&
    Array.isArray(data.nodes) &&
    Array.isArray(data.edges)
  );
}

/** Import a flow from a JSON file. Returns the created flow data or null on failure.
 *  uploadMediaFn should upload a File and return the new URL.
 */
export async function importFlowFromFile(
  file: File,
  uploadMediaFn: (file: File, filename: string) => Promise<string | null>
): Promise<{ name: string; nodes: any[]; edges: any[]; instanceNames: string[] } | null> {
  const toastId = toast.loading("Importando fluxo...");

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!validateImportFile(data)) {
      toast.error("Arquivo inválido. Verifique o formato.", { id: toastId });
      return null;
    }

    const mediaEntries = Object.entries(data.media || {});
    const urlMap: Record<string, string> = {};
    let failedCount = 0;

    // Re-upload each media
    for (let i = 0; i < mediaEntries.length; i += 3) {
      const batch = mediaEntries.slice(i, i + 3);
      const results = await Promise.all(
        batch.map(async ([oldUrl, dataUri]) => {
          try {
            const ext = oldUrl.split(".").pop()?.split("?")[0] || "bin";
            const filename = `imported_${crypto.randomUUID().slice(0, 8)}.${ext}`;
            const mediaFile = dataUriToFile(dataUri as string, filename);
            const newUrl = await uploadMediaFn(mediaFile, filename);
            return { oldUrl, newUrl };
          } catch {
            return { oldUrl, newUrl: null };
          }
        })
      );

      for (const r of results) {
        if (r.newUrl) {
          urlMap[r.oldUrl] = r.newUrl;
        } else {
          failedCount++;
        }
      }
    }

    const updatedNodes = replaceMediaUrls(data.nodes, urlMap);

    if (failedCount > 0) {
      toast.warning(`Importado com ${failedCount} mídia(s) não re-enviada(s)`, { id: toastId });
    } else {
      toast.success(`Fluxo "${data.name}" importado com sucesso!`, { id: toastId });
    }

    return {
      name: data.name,
      nodes: updatedNodes,
      edges: data.edges,
      instanceNames: data.instanceNames || [],
    };
  } catch (err) {
    console.error("Import error:", err);
    toast.error("Erro ao importar fluxo", { id: toastId });
    return null;
  }
}
