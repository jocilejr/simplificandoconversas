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

// GET /api/media-manager/list
router.get("/list", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const workspaceId = req.headers["x-workspace-id"] as string;
    if (!userId || !workspaceId) return res.status(401).json({ error: "Missing auth headers" });

    const userDir = path.join(MEDIA_ROOT, userId);

    // Check if directory exists
    try {
      await fs.access(userDir);
    } catch {
      return res.json({ files: [], totalSize: 0 });
    }

    const files: any[] = [];

    // Scan root level files
    const rootEntries = await fs.readdir(userDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile()) {
        const filePath = path.join(userDir, entry.name);
        const stat = await fs.stat(filePath);
        const mime = getMime(entry.name);
        files.push({
          name: entry.name,
          relativePath: entry.name,
          mime,
          category: getCategory(mime),
          size: stat.size,
          sizeFormatted: formatSize(stat.size),
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
          isTemporary: false,
          url: `/media/${userId}/${entry.name}`,
        });
      }
    }

    // Scan tmp/ subfolder
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
            name: entry.name,
            relativePath: `tmp/${entry.name}`,
            mime,
            category: getCategory(mime),
            size: stat.size,
            sizeFormatted: formatSize(stat.size),
            createdAt: stat.birthtime.toISOString(),
            modifiedAt: stat.mtime.toISOString(),
            isTemporary: true,
            url: `/media/${userId}/tmp/${entry.name}`,
          });
        }
      }
    } catch {
      // tmp dir doesn't exist yet
    }

    // Check which files are "in use" by querying the database
    const sb = getServiceClient();
    const inUseSet = new Set<string>();

    // Check chatbot_flows nodes for media references
    const { data: flows } = await sb
      .from("chatbot_flows")
      .select("nodes")
      .eq("workspace_id", workspaceId);

    if (flows) {
      const flowsJson = JSON.stringify(flows);
      for (const f of files) {
        if (flowsJson.includes(f.name)) inUseSet.add(f.relativePath);
      }
    }

    // Check boleto_recovery_rules media_blocks
    const { data: rules } = await sb
      .from("boleto_recovery_rules")
      .select("media_blocks")
      .eq("workspace_id", workspaceId);

    if (rules) {
      const rulesJson = JSON.stringify(rules);
      for (const f of files) {
        if (rulesJson.includes(f.name)) inUseSet.add(f.relativePath);
      }
    }

    // Check group_scheduled_messages content
    const { data: gsm } = await sb
      .from("group_scheduled_messages")
      .select("content")
      .eq("is_active", true);

    if (gsm) {
      const gsmJson = JSON.stringify(gsm);
      for (const f of files) {
        if (gsmJson.includes(f.name)) inUseSet.add(f.relativePath);
      }
    }

    // Check delivery_products for logos/covers
    const { data: products } = await sb
      .from("delivery_products")
      .select("page_logo, member_cover_image")
      .eq("workspace_id", workspaceId);

    if (products) {
      const prodJson = JSON.stringify(products);
      for (const f of files) {
        if (prodJson.includes(f.name)) inUseSet.add(f.relativePath);
      }
    }

    // Check member_area_materials
    const { data: materials } = await sb
      .from("member_area_materials")
      .select("file_url, thumbnail_url")
      .eq("workspace_id", workspaceId);

    if (materials) {
      const matJson = JSON.stringify(materials);
      for (const f of files) {
        if (matJson.includes(f.name)) inUseSet.add(f.relativePath);
      }
    }

    // Mark in-use files
    for (const f of files) {
      f.inUse = inUseSet.has(f.relativePath);
    }

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
      // Security: prevent path traversal
      const resolved = path.resolve(userDir, relPath);
      if (!resolved.startsWith(userDir)) {
        failed++;
        continue;
      }

      try {
        await fs.unlink(resolved);
        deleted++;
      } catch {
        failed++;
      }
    }

    res.json({ deleted, failed });
  } catch (err: any) {
    console.error("[media-manager] delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
