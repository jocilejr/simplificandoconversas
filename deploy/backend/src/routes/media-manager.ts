import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import fs from "fs/promises";
import path from "path";

const router = Router();

const MEDIA_ROOT = "/media-files";

const MIME_MAP: Record<string, string> = {
  ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  ".mp4": "video/mp4", ".avi": "video/x-msvideo", ".mov": "video/quicktime", ".webm": "video/webm",
  ".pdf": "application/pdf", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function getMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

function getCategory(mime: string): string {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileSource = "flow" | "member" | "group" | "boleto" | "temporary";

interface ScannedFile {
  name: string;
  relativePath: string;
  mime: string;
  category: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  modifiedAt: string;
  isTmpFolder: boolean;
  url: string;
  ownerUserId: string;
}

/** Get all user IDs belonging to a workspace */
async function getWorkspaceUserIds(workspaceId: string): Promise<string[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  if (error) {
    console.error("[media-manager] workspace_members error:", error.message);
    return [];
  }
  return (data || []).map((r: any) => r.user_id);
}

/** Scan files for a single user directory */
async function scanUserFiles(userId: string): Promise<ScannedFile[]> {
  const userDir = path.join(MEDIA_ROOT, userId);
  const files: ScannedFile[] = [];

  try { await fs.access(userDir); } catch { return files; }

  const buildFile = async (filePath: string, relativePath: string, isTmp: boolean): Promise<ScannedFile> => {
    const stat = await fs.stat(filePath);
    const name = path.basename(filePath);
    const mime = getMime(name);
    return {
      name, relativePath, mime,
      category: getCategory(mime), size: stat.size, sizeFormatted: formatSize(stat.size),
      createdAt: stat.birthtime.toISOString(), modifiedAt: stat.mtime.toISOString(),
      isTmpFolder: isTmp, url: `/media/${userId}/${relativePath}`,
      ownerUserId: userId,
    };
  };

  // Scan root files
  const rootEntries = await fs.readdir(userDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile()) {
      files.push(await buildFile(path.join(userDir, entry.name), entry.name, false));
    }
  }

  // Scan subdirs: tmp, boletos
  for (const sub of ["tmp", "boletos"] as const) {
    const subDir = path.join(userDir, sub);
    try {
      await fs.access(subDir);
      const entries = await fs.readdir(subDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const relPath = `${sub}/${entry.name}`;
          files.push(await buildFile(path.join(subDir, entry.name), relPath, sub === "tmp"));
        }
      }
    } catch { /* dir doesn't exist */ }
  }

  return files;
}

/** Scan files for ALL users in a workspace */
async function scanWorkspaceFiles(workspaceId: string): Promise<ScannedFile[]> {
  const userIds = await getWorkspaceUserIds(workspaceId);
  if (userIds.length === 0) return [];

  const allFiles: ScannedFile[] = [];
  for (const uid of userIds) {
    const userFiles = await scanUserFiles(uid);
    allFiles.push(...userFiles);
  }
  return allFiles;
}

/**
 * Returns a Map<key, source> indicating where each file is used.
 * Key = ownerUserId + "/" + relativePath
 */
async function computeSourceMap(workspaceId: string, files: ScannedFile[]): Promise<Map<string, FileSource>> {
  const sb = getServiceClient();
  const sourceMap = new Map<string, FileSource>();
  const fileKey = (f: ScannedFile) => `${f.ownerUserId}/${f.relativePath}`;

  // 1. Check chatbot_flows + boleto_recovery_rules → "flow"
  const { data: flows, error: e1 } = await sb.from("chatbot_flows").select("nodes").eq("workspace_id", workspaceId);
  const { data: rules, error: e2 } = await sb.from("boleto_recovery_rules").select("media_blocks").eq("workspace_id", workspaceId);
  if (e1) console.error("[media-manager] chatbot_flows error:", e1.message);
  if (e2) console.error("[media-manager] boleto_recovery_rules error:", e2.message);
  const flowJson = JSON.stringify(flows || []) + JSON.stringify(rules || []);
  for (const f of files) {
    if (flowJson.includes(f.name)) sourceMap.set(fileKey(f), "flow");
  }

  // 2. Check delivery_products + member_product_materials + member_area_offers → "member"
  const { data: products, error: e3 } = await sb.from("delivery_products").select("page_logo, member_cover_image").eq("workspace_id", workspaceId);
  const { data: materials, error: e4 } = await sb.from("member_product_materials").select("content_url").eq("workspace_id", workspaceId);
  const { data: offers, error: e5 } = await sb.from("member_area_offers").select("image_url").eq("workspace_id", workspaceId);
  if (e3) console.error("[media-manager] delivery_products error:", e3.message);
  if (e4) console.error("[media-manager] member_product_materials error:", e4.message);
  if (e5) console.error("[media-manager] member_area_offers error:", e5.message);
  const memberJson = JSON.stringify(products || []) + JSON.stringify(materials || []) + JSON.stringify(offers || []);

  console.log("[media-manager] source counts:", {
    flows: (flows || []).length, rules: (rules || []).length,
    products: (products || []).length, materials: (materials || []).length, offers: (offers || []).length,
  });

  for (const f of files) {
    if (!sourceMap.has(fileKey(f)) && memberJson.includes(f.name)) {
      sourceMap.set(fileKey(f), "member");
    }
  }

  // 3. Check group_scheduled_messages → "group"
  const { data: gsm } = await sb.from("group_scheduled_messages").select("content").eq("workspace_id", workspaceId).eq("is_active", true);
  const groupJson = JSON.stringify(gsm || []);
  for (const f of files) {
    if (!sourceMap.has(fileKey(f)) && groupJson.includes(f.name)) {
      sourceMap.set(fileKey(f), "group");
    }
  }

  // 4. Boletos folder
  for (const f of files) {
    if (!f.relativePath.startsWith("boletos/")) continue;
    if (sourceMap.has(fileKey(f))) continue;
    sourceMap.set(fileKey(f), "boleto");
  }

  // 5. Everything else → "temporary"
  for (const f of files) {
    if (!sourceMap.has(fileKey(f))) {
      sourceMap.set(fileKey(f), "temporary");
    }
  }

  return sourceMap;
}

/** Check if a boleto file is referenced in transactions (by base name) */
function isBoletoInUse(fileName: string, txnJson: string): boolean {
  const baseName = path.parse(fileName).name;
  return txnJson.includes(fileName) || txnJson.includes(baseName + ".pdf") || txnJson.includes(baseName + ".jpg");
}

// GET /api/media-manager/list
router.get("/list", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const workspaceId = req.headers["x-workspace-id"] as string;
    if (!userId || !workspaceId) return res.status(401).json({ error: "Missing auth headers" });

    const scanned = await scanWorkspaceFiles(workspaceId);
    const sourceMap = await computeSourceMap(workspaceId, scanned);

    // For boleto inUse check
    const sb = getServiceClient();
    const { data: txns } = await sb.from("transactions").select("metadata").eq("workspace_id", workspaceId);
    const txnJson = JSON.stringify(txns || []);

    const fileKey = (f: ScannedFile) => `${f.ownerUserId}/${f.relativePath}`;

    const files = scanned.map((f) => {
      const source = sourceMap.get(fileKey(f)) || "temporary";
      const inUse = source === "boleto"
        ? isBoletoInUse(f.name, txnJson)
        : source !== "temporary";
      return {
        ...f,
        source,
        inUse,
        isTemporary: source === "temporary",
      };
    });

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    res.json({
      files: files.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()),
      totalSize,
      totalSizeFormatted: formatSize(totalSize),
    });
  } catch (err: any) {
    console.error("[media-manager] list error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/media-manager/delete
router.delete("/delete", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const workspaceId = req.headers["x-workspace-id"] as string;
    if (!userId || !workspaceId) return res.status(401).json({ error: "Missing auth headers" });

    // Validate workspace membership
    const validUserIds = new Set(await getWorkspaceUserIds(workspaceId));
    if (!validUserIds.has(userId)) return res.status(403).json({ error: "Not a workspace member" });

    const { files: fileEntries } = req.body as { files: { ownerUserId: string; relativePath: string }[] };
    if (!fileEntries || !Array.isArray(fileEntries) || fileEntries.length === 0) {
      return res.status(400).json({ error: "files array required" });
    }

    let deleted = 0;
    let failed = 0;

    for (const entry of fileEntries) {
      // Validate the ownerUserId belongs to this workspace
      if (!validUserIds.has(entry.ownerUserId)) { failed++; continue; }

      const userDir = path.join(MEDIA_ROOT, entry.ownerUserId);
      const resolved = path.resolve(userDir, entry.relativePath);
      if (!resolved.startsWith(userDir)) { failed++; continue; }
      try { await fs.unlink(resolved); deleted++; } catch { failed++; }
    }

    res.json({ deleted, failed });
  } catch (err: any) {
    console.error("[media-manager] delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/media-manager/cleanup — remove ONLY temporary (>24h) and unlinked boletos (>30d)
router.delete("/cleanup", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const workspaceId = req.headers["x-workspace-id"] as string;
    if (!userId || !workspaceId) return res.status(401).json({ error: "Missing auth headers" });

    const scanned = await scanWorkspaceFiles(workspaceId);
    const sourceMap = await computeSourceMap(workspaceId, scanned);

    // For boleto inUse check
    const sb = getServiceClient();
    const { data: txns } = await sb.from("transactions").select("metadata").eq("workspace_id", workspaceId);
    const txnJson = JSON.stringify(txns || []);

    const fileKey = (f: ScannedFile) => `${f.ownerUserId}/${f.relativePath}`;
    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let freedBytes = 0;

    for (const f of scanned) {
      const source = sourceMap.get(fileKey(f)) || "temporary";

      // NEVER touch flow, member, group files
      if (source === "flow" || source === "member" || source === "group") continue;

      if (source === "boleto") {
        if (isBoletoInUse(f.name, txnJson)) continue;
        if (new Date(f.createdAt).getTime() > cutoff30d) continue;
      } else {
        // temporary: only if older than 24h
        if (new Date(f.createdAt).getTime() > cutoff24h) continue;
      }

      const userDir = path.join(MEDIA_ROOT, f.ownerUserId);
      const resolved = path.resolve(userDir, f.relativePath);
      if (!resolved.startsWith(userDir)) continue;

      try {
        await fs.unlink(resolved);
        deleted++;
        freedBytes += f.size;
      } catch { /* skip */ }
    }

    res.json({ deleted, freedBytes, freedFormatted: formatSize(freedBytes) });
  } catch (err: any) {
    console.error("[media-manager] cleanup error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
