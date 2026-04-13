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
}

async function scanUserFiles(userId: string): Promise<ScannedFile[]> {
  const userDir = path.join(MEDIA_ROOT, userId);
  const files: ScannedFile[] = [];

  try { await fs.access(userDir); } catch { return files; }

  const rootEntries = await fs.readdir(userDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile()) {
      const filePath = path.join(userDir, entry.name);
      const stat = await fs.stat(filePath);
      const mime = getMime(entry.name);
      files.push({
        name: entry.name, relativePath: entry.name, mime,
        category: getCategory(mime), size: stat.size, sizeFormatted: formatSize(stat.size),
        createdAt: stat.birthtime.toISOString(), modifiedAt: stat.mtime.toISOString(),
        isTmpFolder: false, url: `/media/${userId}/${entry.name}`,
      });
    }
  }

  const tmpDir = path.join(userDir, "tmp");
  try {
    await fs.access(tmpDir);
    const tmpEntries = await fs.readdir(tmpDir, { withFileTypes: true });
    for (const entry of tmpEntries) {
      if (entry.isFile()) {
        const filePath = path.join(tmpDir, entry.name);
        const stat = await fs.stat(filePath);
        const mime = getMime(entry.name);
        files.push({
          name: entry.name, relativePath: `tmp/${entry.name}`, mime,
          category: getCategory(mime), size: stat.size, sizeFormatted: formatSize(stat.size),
          createdAt: stat.birthtime.toISOString(), modifiedAt: stat.mtime.toISOString(),
          isTmpFolder: true, url: `/media/${userId}/tmp/${entry.name}`,
        });
      }
    }
  } catch { /* tmp dir doesn't exist */ }

  // Scan boletos/ directory
  const boletosDir = path.join(userDir, "boletos");
  try {
    await fs.access(boletosDir);
    const boletosEntries = await fs.readdir(boletosDir, { withFileTypes: true });
    for (const entry of boletosEntries) {
      if (entry.isFile()) {
        const filePath = path.join(boletosDir, entry.name);
        const stat = await fs.stat(filePath);
        const mime = getMime(entry.name);
        files.push({
          name: entry.name, relativePath: `boletos/${entry.name}`, mime,
          category: getCategory(mime), size: stat.size, sizeFormatted: formatSize(stat.size),
          createdAt: stat.birthtime.toISOString(), modifiedAt: stat.mtime.toISOString(),
          isTmpFolder: false, url: `/media/${userId}/boletos/${entry.name}`,
        });
      }
    }
  } catch { /* boletos dir doesn't exist */ }

  return files;
}

/**
 * Returns a Map<relativePath, source> indicating where each file is used.
 * Priority: flow > member > group > (boleto folder) > temporary
 */
async function computeSourceMap(workspaceId: string, files: ScannedFile[]): Promise<Map<string, FileSource>> {
  const sb = getServiceClient();
  const sourceMap = new Map<string, FileSource>();

  // 1. Check chatbot_flows + boleto_recovery_rules → "flow"
  const { data: flows } = await sb.from("chatbot_flows").select("nodes").eq("workspace_id", workspaceId);
  const { data: rules } = await sb.from("boleto_recovery_rules").select("media_blocks").eq("workspace_id", workspaceId);
  const flowJson = JSON.stringify(flows || []) + JSON.stringify(rules || []);
  for (const f of files) {
    if (flowJson.includes(f.name)) sourceMap.set(f.relativePath, "flow");
  }

  // 2. Check delivery_products + member_area_materials → "member"
  const { data: products } = await sb.from("delivery_products").select("page_logo, member_cover_image").eq("workspace_id", workspaceId);
  const { data: materials } = await sb.from("member_area_materials").select("file_url, thumbnail_url").eq("workspace_id", workspaceId);
  const memberJson = JSON.stringify(products || []) + JSON.stringify(materials || []);
  for (const f of files) {
    if (!sourceMap.has(f.relativePath) && memberJson.includes(f.name)) {
      sourceMap.set(f.relativePath, "member");
    }
  }

  // 3. Check group_scheduled_messages → "group"
  const { data: gsm } = await sb.from("group_scheduled_messages").select("content").eq("is_active", true);
  const groupJson = JSON.stringify(gsm || []);
  for (const f of files) {
    if (!sourceMap.has(f.relativePath) && groupJson.includes(f.name)) {
      sourceMap.set(f.relativePath, "group");
    }
  }

  // 4. Boletos folder — check transactions for base name matching
  const { data: txns } = await sb.from("transactions").select("metadata").eq("workspace_id", workspaceId);
  const txnJson = JSON.stringify(txns || []);
  for (const f of files) {
    if (!f.relativePath.startsWith("boletos/")) continue;
    if (sourceMap.has(f.relativePath)) continue;
    const baseName = path.parse(f.name).name;
    // Mark as boleto; if referenced in transactions it's still "boleto" but inUse
    sourceMap.set(f.relativePath, "boleto");
    // We'll track inUse separately below
  }

  // 5. Everything else → "temporary"
  for (const f of files) {
    if (!sourceMap.has(f.relativePath)) {
      sourceMap.set(f.relativePath, "temporary");
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

    const scanned = await scanUserFiles(userId);
    const sourceMap = await computeSourceMap(workspaceId, scanned);

    // For boleto inUse check
    const sb = getServiceClient();
    const { data: txns } = await sb.from("transactions").select("metadata").eq("workspace_id", workspaceId);
    const txnJson = JSON.stringify(txns || []);

    const files = scanned.map((f) => {
      const source = sourceMap.get(f.relativePath) || "temporary";
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
    if (!userId) return res.status(401).json({ error: "Missing x-user-id" });

    const { files: filePaths } = req.body as { files: string[] };
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return res.status(400).json({ error: "files array required" });
    }

    const userDir = path.join(MEDIA_ROOT, userId);
    let deleted = 0;
    let failed = 0;

    for (const relPath of filePaths) {
      const resolved = path.resolve(userDir, relPath);
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

    const scanned = await scanUserFiles(userId);
    const sourceMap = await computeSourceMap(workspaceId, scanned);

    // For boleto inUse check
    const sb = getServiceClient();
    const { data: txns } = await sb.from("transactions").select("metadata").eq("workspace_id", workspaceId);
    const txnJson = JSON.stringify(txns || []);

    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const userDir = path.join(MEDIA_ROOT, userId);
    let deleted = 0;
    let freedBytes = 0;

    for (const f of scanned) {
      const source = sourceMap.get(f.relativePath) || "temporary";

      // NEVER touch flow, member, group files
      if (source === "flow" || source === "member" || source === "group") continue;

      if (source === "boleto") {
        // Only delete unlinked boletos older than 30 days
        if (isBoletoInUse(f.name, txnJson)) continue;
        if (new Date(f.createdAt).getTime() > cutoff30d) continue;
      } else {
        // temporary: only if older than 24h
        if (new Date(f.createdAt).getTime() > cutoff24h) continue;
      }

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
