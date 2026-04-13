/**
 * Backup parser for "whats-grupos" backup files.
 * Extracts campaigns, scheduled messages, and detects inline media
 * (base64 data URIs embedded in message content).
 */

export interface MediaEntry {
  messageIndex: number;
  fieldName: string;      // e.g. "mediaUrl", "image", "media_url"
  fileName: string;
  dataUri: string;
}

export interface BackupSummary {
  version: number;
  campaigns: any[];
  scheduledMessages: any[];
  mediaKeys: string[];          // kept for backward compat (now derived)
  mediaEntries: MediaEntry[];   // new: actual extractable media
}

/**
 * Parse backup file and extract summary including inline media from messages.
 */
export async function parseBackupSummary(file: File): Promise<BackupSummary> {
  const INITIAL_CHUNK = 10 * 1024 * 1024;
  const initialSlice = file.slice(0, Math.min(INITIAL_CHUNK, file.size));
  const initialText = await initialSlice.text();

  // Extract version
  const versionMatch = initialText.match(/"version"\s*:\s*(\d+)/);
  const version = versionMatch ? parseInt(versionMatch[1]) : 0;

  if (version !== 1) {
    throw new Error(`Versão do backup não suportada: ${version}`);
  }

  let campaigns: any[] = [];
  let scheduledMessages: any[] = [];

  // Find the "data" key position
  const dataMatch = initialText.match(/"data"\s*:\s*\{/);
  if (!dataMatch || dataMatch.index === undefined) {
    throw new Error("O arquivo não contém seção 'data'");
  }

  // Extract campaigns
  const campaignsStart = initialText.indexOf('"campaigns"', dataMatch.index);
  if (campaignsStart !== -1) {
    const arrStart = initialText.indexOf('[', campaignsStart);
    if (arrStart !== -1) {
      const arrEnd = findMatchingBracket(initialText, arrStart);
      if (arrEnd !== -1) {
        try {
          campaigns = JSON.parse(initialText.substring(arrStart, arrEnd + 1));
        } catch {
          console.warn("[backupParser] Failed to parse campaigns array");
        }
      }
    }
  }

  // Extract scheduled_messages
  const msgsStart = initialText.indexOf('"scheduled_messages"', dataMatch.index);
  if (msgsStart !== -1) {
    const arrStart = initialText.indexOf('[', msgsStart);
    if (arrStart !== -1) {
      const arrEnd = findMatchingBracket(initialText, arrStart);
      if (arrEnd !== -1) {
        try {
          scheduledMessages = JSON.parse(initialText.substring(arrStart, arrEnd + 1));
        } catch {
          console.warn("[backupParser] Failed to parse scheduled_messages array");
        }
      }
    }
  }

  if (campaigns.length === 0) {
    throw new Error("O arquivo não contém campanhas.");
  }

  // Extract media from messages instead of top-level media section
  const mediaEntries = extractMediaFromMessages(scheduledMessages);
  const mediaKeys = mediaEntries.map((e, i) => e.fileName || `media-${i}`);

  console.log(`[backupParser] Found ${campaigns.length} campaigns, ${scheduledMessages.length} messages, ${mediaEntries.length} inline media`);

  return { version, campaigns, scheduledMessages, mediaKeys, mediaEntries };
}

// Known field names that may contain media data URIs
const MEDIA_FIELDS = ['mediaUrl', 'media_url', 'image', 'imageUrl', 'image_url', 'fileUrl', 'file_url', 'video', 'videoUrl', 'audio', 'audioUrl'];

/**
 * Scan scheduled messages for inline base64 media (data: URIs).
 */
function extractMediaFromMessages(messages: any[]): MediaEntry[] {
  const entries: MediaEntry[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;

    // Check direct fields on the message
    scanObjectForMedia(msg, i, entries);

    // Check nested content object
    if (msg.content && typeof msg.content === 'object') {
      scanObjectForMedia(msg.content, i, entries);
    }

    // Check nested media object
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
