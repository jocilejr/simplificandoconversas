/**
 * Incremental JSON backup parser for large files (300MB+).
 * Reads the file in chunks to extract metadata without loading
 * the entire file into memory at once.
 */

export interface BackupSummary {
  version: number;
  campaigns: any[];
  scheduledMessages: any[];
  mediaKeys: string[];
}

/**
 * Parse only the metadata section of a backup file.
 * Reads the first chunk to find version + data (campaigns/messages),
 * then scans for media keys without loading media content.
 */
export async function parseBackupSummary(file: File): Promise<BackupSummary> {
  // For the summary we need: version, campaigns, scheduled_messages, media key names.
  // Strategy: read a chunk big enough to contain all the data section (usually <2MB),
  // then scan for media keys in the rest.

  // Step 1: Read first 10MB to extract version + data
  const INITIAL_CHUNK = 10 * 1024 * 1024;
  const initialSlice = file.slice(0, Math.min(INITIAL_CHUNK, file.size));
  const initialText = await initialSlice.text();

  // Extract version
  const versionMatch = initialText.match(/"version"\s*:\s*(\d+)/);
  const version = versionMatch ? parseInt(versionMatch[1]) : 0;

  if (version !== 1) {
    throw new Error(`Versão do backup não suportada: ${version}`);
  }

  // Try to find the data section boundaries
  // We need to extract data.campaigns and data.scheduled_messages
  // without parsing the entire 300MB file
  let campaigns: any[] = [];
  let scheduledMessages: any[] = [];
  let mediaKeys: string[] = [];

  // Find the "data" key position
  const dataMatch = initialText.match(/"data"\s*:\s*\{/);
  if (!dataMatch || dataMatch.index === undefined) {
    throw new Error("O arquivo não contém seção 'data'");
  }

  // Extract campaigns using a targeted approach
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

  // Step 2: Scan for media keys using chunked reading
  // Media section looks like: "media": { "path/to/file": "data:...", ... }
  // We only need the keys, not the (huge) base64 values
  mediaKeys = await scanMediaKeys(file);

  if (campaigns.length === 0) {
    throw new Error("O arquivo não contém campanhas.");
  }

  return { version, campaigns, scheduledMessages, mediaKeys };
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

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
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
 * Scan the file in chunks to extract media object keys.
 * We look for "media": { and then extract keys without loading base64 values.
 */
async function scanMediaKeys(file: File): Promise<string[]> {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
  const keys: string[] = [];
  let remainder = "";
  let inMediaSection = false;
  let depth = 0;

  for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
    const chunk = remainder + await slice.text();
    remainder = "";

    if (!inMediaSection) {
      // Look for "media" : {
      const mediaMatch = chunk.match(/"media"\s*:\s*\{/);
      if (mediaMatch && mediaMatch.index !== undefined) {
        inMediaSection = true;
        depth = 1;
        // Start scanning from after the opening brace
        const startPos = mediaMatch.index + mediaMatch[0].length;
        extractKeysFromChunk(chunk, startPos, keys, { depth, inString: false, escaped: false, inKey: false, inValue: false, currentKey: "" }, (state) => {
          depth = state.depth;
          if (depth <= 0) inMediaSection = false;
        });
      }
      // Keep last 100 chars for boundary matching
      remainder = chunk.slice(-100);
    } else {
      extractKeysFromChunk(chunk, 0, keys, { depth, inString: false, escaped: false, inKey: false, inValue: false, currentKey: "" }, (state) => {
        depth = state.depth;
        if (depth <= 0) inMediaSection = false;
      });
    }

    if (inMediaSection === false && keys.length > 0) break;
  }

  return keys;
}

interface ScanState {
  depth: number;
  inString: boolean;
  escaped: boolean;
  inKey: boolean;
  inValue: boolean;
  currentKey: string;
}

function extractKeysFromChunk(
  chunk: string,
  startPos: number,
  keys: string[],
  state: ScanState,
  onDone: (state: ScanState) => void
) {
  let inString = state.inString;
  let escaped = state.escaped;
  let depth = state.depth;
  let expectKey = true; // at depth 1, we expect keys
  let keyBuffer = "";
  let collectingKey = false;
  let skipValue = false;

  for (let i = startPos; i < chunk.length; i++) {
    const ch = chunk[i];

    if (escaped) {
      if (collectingKey) keyBuffer += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      if (collectingKey) keyBuffer += ch;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        if (depth === 1 && expectKey) {
          collectingKey = true;
          keyBuffer = "";
        }
      } else {
        inString = false;
        if (collectingKey) {
          collectingKey = false;
          // Next we expect a colon then a value
        }
      }
      continue;
    }

    if (inString) {
      if (collectingKey) keyBuffer += ch;
      continue;
    }

    // Outside string
    if (ch === ':' && depth === 1 && keyBuffer) {
      keys.push(keyBuffer);
      expectKey = false;
      skipValue = true;
      keyBuffer = "";
      continue;
    }

    if (ch === '{' || ch === '[') {
      depth++;
      continue;
    }

    if (ch === '}' || ch === ']') {
      depth--;
      if (depth <= 0) {
        onDone({ depth, inString, escaped, inKey: false, inValue: false, currentKey: "" });
        return;
      }
      continue;
    }

    if (ch === ',' && depth === 1) {
      expectKey = true;
      skipValue = false;
      continue;
    }
  }

  onDone({ depth, inString, escaped, inKey: collectingKey, inValue: skipValue, currentKey: keyBuffer });
}

/**
 * Iterator that yields media entries one at a time from the backup file.
 * Each yield returns { path, dataUri } without holding all media in memory.
 */
export async function* iterateMediaEntries(file: File): AsyncGenerator<{ path: string; dataUri: string }> {
  // We need to find "media": { then extract key-value pairs one at a time.
  // Since values can be huge (multi-MB base64), we read in chunks and reconstruct each entry.
  
  const text = await file.text();
  const mediaMatch = text.match(/"media"\s*:\s*\{/);
  if (!mediaMatch || mediaMatch.index === undefined) return;

  const startPos = mediaMatch.index + mediaMatch[0].length;
  
  // Now parse key-value pairs from the media object
  let pos = startPos;
  let depth = 1;

  while (pos < text.length && depth > 0) {
    // Skip whitespace and commas
    while (pos < text.length && /[\s,]/.test(text[pos])) pos++;

    if (text[pos] === '}') { depth--; break; }

    // Extract key
    if (text[pos] !== '"') break;
    const keyEnd = findStringEnd(text, pos);
    if (keyEnd === -1) break;
    const key = JSON.parse(text.substring(pos, keyEnd + 1));
    pos = keyEnd + 1;

    // Skip colon
    while (pos < text.length && /[\s:]/.test(text[pos])) pos++;

    // Extract value
    if (text[pos] !== '"') {
      // skip non-string value
      const valEnd = text.indexOf(',', pos);
      pos = valEnd === -1 ? text.length : valEnd + 1;
      continue;
    }
    const valEnd = findStringEnd(text, pos);
    if (valEnd === -1) break;
    const value = JSON.parse(text.substring(pos, valEnd + 1));
    pos = valEnd + 1;

    yield { path: key, dataUri: value };
  }
}

function findStringEnd(text: string, openQuotePos: number): number {
  let escaped = false;
  for (let i = openQuotePos + 1; i < text.length; i++) {
    if (escaped) { escaped = false; continue; }
    if (text[i] === '\\') { escaped = true; continue; }
    if (text[i] === '"') return i;
  }
  return -1;
}

/**
 * Convert a data URI to a File object for FormData upload.
 */
export function dataUriToFile(dataUri: string, filename: string): File {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URI");

  const mimeType = match[1];
  const base64 = match[2];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mimeType });
}
