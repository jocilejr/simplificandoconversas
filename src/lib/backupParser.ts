/**
 * Backup parser for "whats-grupos" backup files.
 *
 * Backup format (from original whats-grupos source):
 * {
 *   "version": 1,
 *   "source_url": "https://xxx.supabase.co",
 *   "data": {
 *     "campaigns": [...],
 *     "scheduled_messages": [...]
 *   },
 *   "media": {
 *     "userId/1234-foto.png": "data:image/png;base64,iVBOR...",
 *     ...
 *   }
 * }
 *
 * Messages reference media via full Supabase Storage URLs like:
 * https://xxx.supabase.co/storage/v1/object/public/media/userId/1234-foto.png
 */

export interface MediaEntry {
  messageIndex: number;
  fieldName: string;
  fileName: string;
  dataUri: string;
}

export interface BackupSummary {
  version: number;
  sourceUrl: string;
  campaigns: any[];
  scheduledMessages: any[];
  topLevelMedia: Record<string, string>;   // path → dataUri
  mediaKeys: string[];                     // Object.keys(topLevelMedia)
  mediaEntries: MediaEntry[];              // kept for backward compat (inline media fallback)
}

/**
 * Parse backup file and extract summary including top-level media section.
 */
export async function parseBackupSummary(file: File): Promise<BackupSummary> {
  const text = await file.text();

  // Extract version
  const versionMatch = text.match(/"version"\s*:\s*(\d+)/);
  const version = versionMatch ? parseInt(versionMatch[1]) : 0;

  if (version !== 1) {
    throw new Error(`Versão do backup não suportada: ${version}`);
  }

  // Extract source_url
  const sourceUrlMatch = text.match(/"source_url"\s*:\s*"([^"]+)"/);
  const sourceUrl = sourceUrlMatch ? sourceUrlMatch[1] : '';

  let campaigns: any[] = [];
  let scheduledMessages: any[] = [];

  // Find the "data" key position
  const dataMatch = text.match(/"data"\s*:\s*\{/);
  if (!dataMatch || dataMatch.index === undefined) {
    throw new Error("O arquivo não contém seção 'data'");
  }

  // Extract campaigns
  const campaignsStart = text.indexOf('"campaigns"', dataMatch.index);
  if (campaignsStart !== -1) {
    const arrStart = text.indexOf('[', campaignsStart);
    if (arrStart !== -1) {
      const arrEnd = findMatchingBracket(text, arrStart);
      if (arrEnd !== -1) {
        try {
          campaigns = JSON.parse(text.substring(arrStart, arrEnd + 1));
        } catch {
          console.warn("[backupParser] Failed to parse campaigns array");
        }
      }
    }
  }

  // Extract scheduled_messages
  const msgsStart = text.indexOf('"scheduled_messages"', dataMatch.index);
  if (msgsStart !== -1) {
    const arrStart = text.indexOf('[', msgsStart);
    if (arrStart !== -1) {
      const arrEnd = findMatchingBracket(text, arrStart);
      if (arrEnd !== -1) {
        try {
          scheduledMessages = JSON.parse(text.substring(arrStart, arrEnd + 1));
        } catch {
          console.warn("[backupParser] Failed to parse scheduled_messages array");
        }
      }
    }
  }

  if (campaigns.length === 0) {
    throw new Error("O arquivo não contém campanhas.");
  }

  // Extract top-level "media" section (outside "data")
  // The media section is at the same level as "data" and "version"
  let topLevelMedia: Record<string, string> = {};

  // Find the end of the "data" section to search for "media" after it
  const dataObjStart = text.indexOf('{', dataMatch.index! + dataMatch[0].length - 1);
  const dataObjEnd = dataObjStart !== -1 ? findMatchingBracket(text, dataObjStart) : -1;

  if (dataObjEnd !== -1) {
    // Search for "media" after the data section ends
    const mediaKeyIdx = text.indexOf('"media"', dataObjEnd);
    if (mediaKeyIdx !== -1) {
      const mediaObjStart = text.indexOf('{', mediaKeyIdx);
      if (mediaObjStart !== -1) {
        const mediaObjEnd = findMatchingBracket(text, mediaObjStart);
        if (mediaObjEnd !== -1) {
          try {
            topLevelMedia = JSON.parse(text.substring(mediaObjStart, mediaObjEnd + 1));
          } catch {
            console.warn("[backupParser] Failed to parse top-level media object");
          }
        }
      }
    }
  }

  // Also try searching before "data" in case media comes first
  if (Object.keys(topLevelMedia).length === 0) {
    const mediaBeforeData = text.substring(0, dataMatch.index).lastIndexOf('"media"');
    if (mediaBeforeData !== -1) {
      const mediaObjStart = text.indexOf('{', mediaBeforeData);
      if (mediaObjStart !== -1) {
        const mediaObjEnd = findMatchingBracket(text, mediaObjStart);
        if (mediaObjEnd !== -1) {
          try {
            topLevelMedia = JSON.parse(text.substring(mediaObjStart, mediaObjEnd + 1));
          } catch {
            console.warn("[backupParser] Failed to parse top-level media object (before data)");
          }
        }
      }
    }
  }

  const mediaKeys = Object.keys(topLevelMedia);

  // Fallback: also extract inline media from messages (backward compat)
  const mediaEntries = extractMediaFromMessages(scheduledMessages);

  console.log(`[backupParser] Found ${campaigns.length} campaigns, ${scheduledMessages.length} messages, ${mediaKeys.length} top-level media, ${mediaEntries.length} inline media, sourceUrl: ${sourceUrl}`);

  return { version, sourceUrl, campaigns, scheduledMessages, topLevelMedia, mediaKeys, mediaEntries };
}

// Known field names that may contain media data URIs
const MEDIA_FIELDS = ['mediaUrl', 'media_url', 'image', 'imageUrl', 'image_url', 'fileUrl', 'file_url', 'video', 'videoUrl', 'audio', 'audioUrl'];

/**
 * Scan scheduled messages for inline base64 media (data: URIs) — fallback only.
 */
function extractMediaFromMessages(messages: any[]): MediaEntry[] {
  const entries: MediaEntry[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;
    scanObjectForMedia(msg, i, entries);
    if (msg.content && typeof msg.content === 'object') {
      scanObjectForMedia(msg.content, i, entries);
    }
    if (msg.media && typeof msg.media === 'object') {
      scanObjectForMedia(msg.media, i, entries);
    }
  }
  return entries;
}

function scanObjectForMedia(obj: any, messageIndex: number, entries: MediaEntry[]) {
  for (const field of MEDIA_FIELDS) {
    const val = obj[field];
    if (typeof val === 'string' && val.startsWith('data:')) {
      const fileName = obj.fileName || obj.file_name || obj.filename || `media-${messageIndex}-${field}`;
      entries.push({ messageIndex, fieldName: field, fileName, dataUri: val });
    }
  }
}

/**
 * Find the matching closing bracket for an opening bracket.
 */
function findMatchingBracket(text: string, openPos: number): number {
  const openChar = text[openPos];
  const closeChar = openChar === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openPos; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Infer MIME type from file extension.
 */
function mimeFromExt(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
    mp4: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Convert a data URI (or raw base64) to a File object for FormData upload.
 */
export function dataUriToFile(dataUri: string, filename: string): File {
  let mimeType = 'application/octet-stream';
  let base64Payload = '';

  if (dataUri.startsWith('data:')) {
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) {
      throw new Error(`Formato de mídia não reconhecido: sem separador de dados no data URI (${filename})`);
    }
    const header = dataUri.substring(5, commaIdx);
    base64Payload = dataUri.substring(commaIdx + 1);

    const headerParts = header.split(';');
    if (headerParts.length > 0 && headerParts[0].includes('/')) {
      mimeType = headerParts[0];
    }
  } else {
    base64Payload = dataUri;
    mimeType = mimeFromExt(filename);
  }

  base64Payload = base64Payload.replace(/[\s\r\n]/g, '');

  if (!base64Payload) {
    throw new Error(`Mídia vazia para ${filename}`);
  }

  if (mimeType === 'application/octet-stream') {
    mimeType = mimeFromExt(filename);
  }

  try {
    const binaryStr = atob(base64Payload);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mimeType });
  } catch (e: any) {
    throw new Error(`Falha ao decodificar base64 para ${filename}: ${e.message}`);
  }
}
