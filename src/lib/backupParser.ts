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
 * Reads the file in chunks to avoid loading 300MB+ into memory.
 */
export async function* iterateMediaEntries(file: File): AsyncGenerator<{ path: string; dataUri: string }> {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB

  // Step 1: Find the byte offset of "media": {
  let mediaStartOffset = -1;
  let searchBuffer = "";

  for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
    const chunk = await slice.text();
    searchBuffer += chunk;

    const match = searchBuffer.match(/"media"\s*:\s*\{/);
    if (match && match.index !== undefined) {
      // Calculate absolute byte offset of the opening brace content
      const relativePos = match.index + match[0].length;
      // Account for multi-byte chars: use the actual text offset from current window
      mediaStartOffset = offset - (searchBuffer.length - chunk.length) + relativePos;
      break;
    }

    // Keep last 100 chars for boundary matching
    if (searchBuffer.length > 200) {
      const discard = searchBuffer.length - 100;
      searchBuffer = searchBuffer.slice(discard);
    }
  }

  if (mediaStartOffset < 0) return;

  // Step 2: Read from mediaStartOffset in chunks, extracting key-value pairs
  let buffer = "";
  let filePos = mediaStartOffset;
  let depth = 1; // we're inside the media object

  // States for the parser
  const enum State { EXPECT_KEY, IN_KEY, EXPECT_COLON, EXPECT_VALUE, IN_VALUE, AFTER_VALUE }
  let state: State = State.EXPECT_KEY;
  let currentKey = "";
  let currentValue = "";
  let escaped = false;

  const loadMoreBuffer = async (): Promise<boolean> => {
    if (filePos >= file.size) return false;
    const end = Math.min(filePos + CHUNK_SIZE, file.size);
    const slice = file.slice(filePos, end);
    buffer += await slice.text();
    filePos = end;
    return true;
  };

  // Initial load
  await loadMoreBuffer();

  let i = 0;
  while (true) {
    // Need more data?
    if (i >= buffer.length) {
      // Trim consumed part
      buffer = buffer.slice(i);
      i = 0;
      const loaded = await loadMoreBuffer();
      if (!loaded && buffer.length === 0) break;
      if (buffer.length === 0) break;
    }

    const ch = buffer[i];

    if (state === State.EXPECT_KEY) {
      if (ch === '}') { depth--; if (depth <= 0) break; i++; continue; }
      if (ch === '"') { state = State.IN_KEY; currentKey = ""; escaped = false; i++; continue; }
      if (/\s/.test(ch) || ch === ',') { i++; continue; }
      // unexpected char, skip
      i++; continue;
    }

    if (state === State.IN_KEY) {
      if (escaped) { currentKey += ch; escaped = false; i++; continue; }
      if (ch === '\\') { escaped = true; i++; continue; }
      if (ch === '"') { state = State.EXPECT_COLON; i++; continue; }
      currentKey += ch; i++; continue;
    }

    if (state === State.EXPECT_COLON) {
      if (ch === ':') { state = State.EXPECT_VALUE; i++; continue; }
      if (/\s/.test(ch)) { i++; continue; }
      i++; continue;
    }

    if (state === State.EXPECT_VALUE) {
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"') {
        state = State.IN_VALUE;
        currentValue = "";
        escaped = false;
        i++;
        continue;
      }
      // Non-string value (null, number) — skip until comma or }
      while (i < buffer.length && buffer[i] !== ',' && buffer[i] !== '}') i++;
      state = State.EXPECT_KEY;
      continue;
    }

    if (state === State.IN_VALUE) {
      // Accumulate the value string, loading more chunks as needed
      // Process in bulk for performance
      let searchFrom = i;
      while (true) {
        // Scan for end of string in current buffer
        let foundEnd = false;
        for (let j = searchFrom; j < buffer.length; j++) {
          const c = buffer[j];
          if (escaped) { escaped = false; continue; }
          if (c === '\\') { escaped = true; continue; }
          if (c === '"') {
            // Found end of value string
            currentValue += buffer.slice(i, j);
            i = j + 1;
            foundEnd = true;
            break;
          }
        }

        if (foundEnd) {
          // Yield the entry
          yield { path: currentKey, dataUri: currentValue };
          // Free memory
          currentKey = "";
          currentValue = "";
          state = State.EXPECT_KEY;

          // Trim consumed buffer to free memory
          if (i > CHUNK_SIZE) {
            buffer = buffer.slice(i);
            i = 0;
          }
          break;
        }

        // Didn't find end — accumulate what we have and load more
        currentValue += buffer.slice(i, buffer.length);
        buffer = "";
        i = 0;
        searchFrom = 0;
        const loaded = await loadMoreBuffer();
        if (!loaded) {
          // Incomplete value, discard
          state = State.EXPECT_KEY;
          break;
        }
      }
      continue;
    }

    i++;
  }
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
 * Handles variations: charset params, name params, whitespace in base64, raw base64 without data: prefix.
 */
export function dataUriToFile(dataUri: string, filename: string): File {
  let mimeType = 'application/octet-stream';
  let base64Payload = '';

  if (dataUri.startsWith('data:')) {
    // Find the comma that separates header from payload
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) {
      throw new Error(`Formato de mídia não reconhecido: sem separador de dados no data URI (${filename})`);
    }
    const header = dataUri.substring(5, commaIdx); // after "data:" and before ","
    base64Payload = dataUri.substring(commaIdx + 1);

    // header can be: "image/png;base64" or "image/png;charset=utf-8;base64" or "image/png;name=file.png;base64"
    const headerParts = header.split(';');
    if (headerParts.length > 0 && headerParts[0].includes('/')) {
      mimeType = headerParts[0];
    }
  } else {
    // Raw base64 without data: prefix — try to use it directly
    base64Payload = dataUri;
    mimeType = mimeFromExt(filename);
  }

  // Clean whitespace/newlines from base64 payload
  base64Payload = base64Payload.replace(/[\s\r\n]/g, '');

  if (!base64Payload) {
    throw new Error(`Mídia vazia para ${filename}`);
  }

  // Fallback: if mime is generic, try from filename
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
