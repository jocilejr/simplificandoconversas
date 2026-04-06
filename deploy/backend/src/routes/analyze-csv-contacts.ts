import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "";

// ─── Email normalizer ─────────────────────────────────────────────────────

const CANONICAL_DOMAINS = [
  "gmail.com","hotmail.com","hotmail.com.br","outlook.com","outlook.com.br",
  "yahoo.com","yahoo.com.br","icloud.com","live.com","uol.com.br","bol.com.br",
  "terra.com.br","ig.com.br","globo.com","globomail.com","protonmail.com",
  "msn.com","aol.com","zoho.com","r7.com",
];
const CANONICAL_SET = new Set(CANONICAL_DOMAINS);
const KNOWN_ALIASES: Record<string,string> = {
  "gmail.com.br":"gmail.com","uol.com":"uol.com.br","bol.com":"bol.com.br",
  "terra.com":"terra.com.br","ig.com":"ig.com.br",
};

function damerauLevenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  const d: number[][] = [];
  for (let i = 0; i <= la; i++) { d[i] = new Array(lb + 1).fill(0); }
  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost);
      if (i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1])
        d[i][j] = Math.min(d[i][j], d[i-2][j-2]+cost);
    }
  }
  return d[la][lb];
}

function cleanDomain(raw: string): string {
  let c = raw.replace(/^[^a-z]+/, "");
  c = c.replace(/[^a-z.]+$/, "");
  c = c.replace(/\.+$/, "");
  return c;
}

function hasValidStructure(domain: string): boolean {
  if (!domain.includes(".")) return false;
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  if (!/^[a-z]{2,6}$/.test(tld)) return false;
  if (tld === "br" && parts.length >= 3) {
    const sld = parts[parts.length - 2];
    if (!/^[a-z]{2,4}$/.test(sld)) return false;
  }
  const provider = parts[0];
  if (!provider || !/^[a-z]/.test(provider)) return false;
  return true;
}

function findBestMatch(inputDomain: string) {
  const cleaned = cleanDomain(inputDomain);
  const dists: { domain: string; dist: number }[] = [];
  for (const cd of CANONICAL_DOMAINS) {
    const distRaw = damerauLevenshtein(inputDomain, cd);
    const distClean = damerauLevenshtein(cleaned, cd);
    const dist = Math.min(distRaw, distClean);
    dists.push({ domain: cd, dist });
  }
  dists.sort((a, b) => a.dist - b.dist);
  if (dists.length === 0) return null;
  const best = dists[0];
  const second = dists.length > 1 ? dists[1] : null;
  const gap = second ? second.dist - best.dist : best.dist + 2;
  const maxLen = Math.max(inputDomain.length, best.domain.length);
  const similarity = 1 - best.dist / maxLen;

  let confidence: number;
  if (best.dist === 0) confidence = 1;
  else if (best.dist === 1 && gap >= 1) confidence = 0.95;
  else if (best.dist <= 2 && gap >= 2) confidence = 0.9;
  else if (best.dist <= 2 && gap >= 1) confidence = 0.85;
  else if (best.dist <= 3 && gap >= 2 && similarity >= 0.65) confidence = 0.8;
  else if (best.dist <= 3 && gap >= 1 && similarity >= 0.6) confidence = 0.75;
  else if (best.dist <= 4 && gap >= 2 && similarity >= 0.6) confidence = 0.65;
  else if (best.dist <= 4 && gap >= 1 && similarity >= 0.55) confidence = 0.55;
  else if (similarity >= 0.5) confidence = 0.4;
  else confidence = 0.2;

  return { domain: best.domain, distance: best.dist, confidence };
}

function normalizeEmail(input: string): { email: string; status: "valid" | "corrected" | "invalid"; original_email?: string; reason?: string } {
  const original = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!original) return { email: original, status: "invalid", reason: "vazio" };

  let localPart: string;
  let domain: string;

  if (original.includes("@")) {
    const atIdx = original.indexOf("@");
    localPart = original.substring(0, atIdx);
    domain = original.substring(atIdx + 1);
  } else {
    for (const cd of CANONICAL_DOMAINS) {
      if (original.endsWith(cd) && original.length > cd.length) {
        localPart = original.substring(0, original.length - cd.length);
        domain = cd;
        return { email: `${localPart}@${domain}`, status: "corrected", original_email: original, reason: "@ inserido" };
      }
    }
    return { email: original, status: "invalid", reason: "sem @" };
  }

  if (!localPart || !domain) return { email: original, status: "invalid", reason: "parte local ou domínio vazio" };

  domain = domain.replace(/\.+$/, "");
  const cleanedDomain = cleanDomain(domain);

  const aliasKey = KNOWN_ALIASES[domain] ? domain : KNOWN_ALIASES[cleanedDomain] ? cleanedDomain : null;
  if (aliasKey) {
    const target = KNOWN_ALIASES[aliasKey];
    return { email: `${localPart}@${target}`, status: "corrected", original_email: original, reason: `${domain} → ${target}` };
  }

  if (CANONICAL_SET.has(domain)) {
    const finalEmail = `${localPart}@${domain}`;
    return finalEmail !== original
      ? { email: finalEmail, status: "corrected", original_email: original, reason: "limpeza" }
      : { email: finalEmail, status: "valid" };
  }

  const match = findBestMatch(domain);
  if (!match) return { email: `${localPart}@${domain}`, status: "valid" };

  if (match.distance === 0 && domain !== match.domain) {
    return { email: `${localPart}@${match.domain}`, status: "corrected", original_email: original, reason: `limpeza: ${domain} → ${match.domain}` };
  }
  if (match.distance === 0) return { email: `${localPart}@${match.domain}`, status: "valid" };

  if (match.confidence >= 0.7) {
    return { email: `${localPart}@${match.domain}`, status: "corrected", original_email: original, reason: `${domain} → ${match.domain} (${Math.round(match.confidence * 100)}%)` };
  }

  if (hasValidStructure(domain)) return { email: `${localPart}@${domain}`, status: "valid" };

  return { email: `${localPart}@${domain}`, status: "invalid", reason: "domínio não reconhecido" };
}

// ─── Column classifiers ────────────────────────────────────────────────────

function isTimestampLike(value: string): boolean {
  if (!value) return false;
  if (/\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}/.test(value)) return true;
  if (/\d{2}[-/]\d{2}[-/]\d{4}[\sT]\d{2}:\d{2}/.test(value)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  // Also catch standalone dates with time: "2025-09-09 02:35:32.632"
  if (/^\d{4}-\d{2}-\d{2}\s/.test(value)) return true;
  return false;
}

function isEmailLike(value: string): boolean {
  if (!value) return false;
  const v = value.trim();
  const atCount = (v.match(/@/g) || []).length;
  if (atCount !== 1) return false;
  if (/[,;|\t]/.test(v)) return false;
  if (/\s/.test(v)) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return false;
  return true;
}

function isHumanNameLike(value: string): boolean {
  if (!value || value.length < 2 || value.length > 80) return false;
  if (value.includes("@")) return false;
  if (isTimestampLike(value)) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(value)) return false;
  if (/^\d+$/.test(value)) return false;
  if (/^[a-zA-ZÀ-ÿ]+\d+$/.test(value)) return false;
  if (/^\d+[a-zA-ZÀ-ÿ]+$/.test(value)) return false;
  if (!value.includes(" ") && value.length <= 12 && /^[a-z0-9_-]+$/i.test(value)) return false;
  return true;
}

// ─── CSV parser ────────────────────────────────────────────────────────────

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { result.push(current.trim()); current = ""; }
      else current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeCSVInput(csvText: string): string[] {
  let text = csvText;
  // Remove BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip sep= lines
    if (/^sep\s*=\s*.$/i.test(trimmed)) continue;
    result.push(trimmed);
  }
  
  return result;
}

function detectDelimiter(lines: string[]): string {
  const candidates = [",", "\t", ";", "|"];
  const testLines = lines.slice(0, Math.min(lines.length, 10));

  let bestDelim = ",";
  let bestScore = -1;

  for (const delim of candidates) {
    // Use parseCSVLine for accurate column counting
    const counts = testLines.map(l => parseCSVLine(l, delim).length);
    const colCount = counts[0];
    
    if (colCount <= 1) continue;
    
    const allSame = counts.every(c => c === counts[0]);
    if (allSame) {
      // Consistent column count = high confidence
      const score = colCount * 1000 + (delim === "," ? 2 : delim === "\t" ? 3 : 1);
      if (score > bestScore) { bestScore = score; bestDelim = delim; }
    } else {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((a, b) => a + Math.abs(b - avg), 0) / counts.length;
      if (avg > 1.5 && variance < 1) {
        const score = avg * 100 - variance * 50;
        if (score > bestScore) { bestScore = score; bestDelim = delim; }
      }
    }
  }

  return bestDelim;
}

function hasHeaderRow(firstLine: string, delimiter: string): boolean {
  const cols = parseCSVLine(firstLine, delimiter);
  // If any column contains @, it's data not header
  if (cols.some(c => c.includes("@"))) return false;
  // If columns look like labels (email, nome, name, tag, etc.)
  const headerKeywords = /^(e-?mail|nome|name|tag|tags|data|date|status|categoria|grupo|etapa|origem)$/i;
  if (cols.some(c => headerKeywords.test(c.trim()))) return true;
  // Default: if no @ found, assume header
  return true;
}

// ─── Column type detection ─────────────────────────────────────────────────

type ColumnType = "email" | "name" | "tag" | "timestamp" | "unknown";

function classifyColumns(dataLines: string[], delimiter: string, numCols: number): ColumnType[] {
  const sampleSize = Math.min(dataLines.length, 50);
  const colStats = Array.from({ length: numCols }, () => ({
    emailCount: 0, timestampCount: 0, nameCount: 0, tagCount: 0, total: 0,
  }));

  for (let i = 0; i < sampleSize; i++) {
    const cols = parseCSVLine(dataLines[i], delimiter);
    for (let c = 0; c < Math.min(cols.length, numCols); c++) {
      const val = cols[c]?.trim();
      if (!val) continue;
      colStats[c].total++;
      if (isEmailLike(val)) colStats[c].emailCount++;
      if (isTimestampLike(val)) colStats[c].timestampCount++;
      if (isHumanNameLike(val)) colStats[c].nameCount++;
      // Only count as tag if it's not timestamp and not email
      if (!isTimestampLike(val) && !isEmailLike(val) && val.length <= 60) colStats[c].tagCount++;
    }
  }

  const types: ColumnType[] = new Array(numCols).fill("unknown");

  // 1. Find email column - use LOW threshold (even 1 email in sample is enough)
  let bestEmailIdx = -1;
  let bestEmailRatio = 0;
  for (let c = 0; c < numCols; c++) {
    const ratio = colStats[c].total > 0 ? colStats[c].emailCount / colStats[c].total : 0;
    if (ratio > bestEmailRatio) {
      bestEmailRatio = ratio;
      bestEmailIdx = c;
    }
  }
  // Accept if at least 20% of values look like emails (was 30%, too strict)
  if (bestEmailIdx >= 0 && bestEmailRatio >= 0.2) {
    types[bestEmailIdx] = "email";
  }

  // 2. Classify remaining columns
  for (let c = 0; c < numCols; c++) {
    if (types[c] !== "unknown") continue;
    const s = colStats[c];
    if (s.total === 0) continue;

    const tsRatio = s.timestampCount / s.total;
    const nameRatio = s.nameCount / s.total;

    if (tsRatio > 0.4) {
      types[c] = "timestamp";
    } else if (nameRatio > 0.4) {
      types[c] = "name";
    } else {
      types[c] = "tag";
    }
  }

  return types;
}

// ─── Row-level fallback ───────────────────────────────────────────────────

function extractContactFromRow(tokens: string[]): { email: string; name: string | null; tags: string[] } | null {
  let email: string | null = null;
  let name: string | null = null;
  const tags: string[] = [];

  for (const token of tokens) {
    const val = token.trim();
    if (!val) continue;

    if (!email && isEmailLike(val)) {
      email = val;
    } else if (isTimestampLike(val)) {
      // skip timestamps entirely
      continue;
    } else if (isHumanNameLike(val)) {
      if (!name) name = val;
      else tags.push(val);
    } else if (val.length <= 60) {
      tags.push(val);
    }
  }

  if (!email) return null;
  return { email, name, tags };
}

// ─── Heuristic analyzer ───────────────────────────────────────────────────

function analyzeCSVHeuristic(csvText: string) {
  const lines = normalizeCSVInput(csvText);
  if (lines.length < 1) {
    return { contacts: [], total_csv_lines: 0, mode: "heuristic", debug: { error: "CSV vazio" } };
  }

  const delimiter = detectDelimiter(lines);
  const headerPresent = hasHeaderRow(lines[0], delimiter);
  const dataLines = headerPresent ? lines.slice(1) : lines;

  if (dataLines.length === 0) {
    return { contacts: [], total_csv_lines: 0, mode: "heuristic", debug: { delimiter, headerPresent, error: "Sem linhas de dados" } };
  }

  const firstParsed = parseCSVLine(dataLines[0], delimiter);
  const numCols = firstParsed.length;
  const colTypes = classifyColumns(dataLines, delimiter, numCols);

  const emailCol = colTypes.indexOf("email");
  const nameCol = colTypes.indexOf("name");
  const tagCols = colTypes.map((t, i) => ({ t, i })).filter(x => x.t === "tag").map(x => x.i);

  const debugInfo = {
    delimiter: delimiter === "\t" ? "TAB" : delimiter,
    headerPresent,
    numCols,
    colTypes,
    emailCol,
    nameCol,
    tagCols,
    firstDataRow: firstParsed,
    method: emailCol >= 0 ? "column-based" : "row-scan-fallback",
  };

  console.log(`[analyze-csv] delimiter=${JSON.stringify(delimiter)}, header=${headerPresent}, lines=${dataLines.length}, cols=${numCols}`);
  console.log(`[analyze-csv] colTypes=${JSON.stringify(colTypes)}, emailCol=${emailCol}, nameCol=${nameCol}, tagCols=${JSON.stringify(tagCols)}`);
  console.log(`[analyze-csv] firstDataRow=${JSON.stringify(firstParsed)}`);

  const contacts: any[] = [];

  if (emailCol >= 0) {
    // ─── Column-based extraction ───
    for (const line of dataLines) {
      const cols = parseCSVLine(line, delimiter);
      const rawEmail = cols[emailCol]?.trim();
      if (!rawEmail) continue;

      if (/[,;|\t]/.test(rawEmail) || /\s/.test(rawEmail)) {
        contacts.push({ email: rawEmail, status: "invalid", reason: "contém delimitadores ou espaços" });
        continue;
      }

      const normalized = normalizeEmail(rawEmail);
      if (normalized.status === "invalid") {
        contacts.push({ email: rawEmail, status: "invalid", reason: normalized.reason });
        continue;
      }

      const name = nameCol >= 0 ? cols[nameCol]?.trim() || null : null;
      const tags: string[] = [];
      for (const tc of tagCols) {
        const val = cols[tc]?.trim();
        if (val && !isTimestampLike(val)) tags.push(val);
      }

      contacts.push({
        email: normalized.email,
        name,
        tags,
        status: normalized.status,
        original_email: normalized.original_email,
        reason: normalized.reason,
      });
    }
  } else {
    // ─── ROW-SCAN FALLBACK: no clear email column, scan each row for @ ───
    console.log("[analyze-csv] No email column elected, using row-scan fallback");
    for (const line of dataLines) {
      const cols = parseCSVLine(line, delimiter);
      const extracted = extractContactFromRow(cols);
      if (!extracted) continue;

      const normalized = normalizeEmail(extracted.email);
      if (normalized.status === "invalid") {
        contacts.push({ email: extracted.email, status: "invalid", reason: normalized.reason });
        continue;
      }

      // Filter out timestamps from tags
      const cleanTags = extracted.tags.filter(t => !isTimestampLike(t));

      contacts.push({
        email: normalized.email,
        name: extracted.name,
        tags: cleanTags,
        status: normalized.status,
        original_email: normalized.original_email,
        reason: normalized.reason,
      });
    }
  }

  const validCount = contacts.filter(c => c.status !== "invalid").length;
  const correctedCount = contacts.filter(c => c.status === "corrected").length;
  const invalidCount = contacts.filter(c => c.status === "invalid").length;
  console.log(`[analyze-csv] Result: ${contacts.length} total, ${validCount} valid, ${correctedCount} corrected, ${invalidCount} invalid (method: ${debugInfo.method})`);

  return { contacts, total_csv_lines: dataLines.length, mode: "heuristic", debug: debugInfo };
}

// ─── Route ─────────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.replace("Bearer ", "");
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { csv_text } = req.body;
    if (!csv_text || typeof csv_text !== "string") {
      return res.status(400).json({ error: "csv_text is required" });
    }

    const rawLines = csv_text.split(/\r?\n/).filter(Boolean).length;
    console.log(`[analyze-csv] Received CSV with ${rawLines} raw lines, mode=${process.env.CSV_ANALYZER_MODE || "auto"}`);

    // Always use heuristic - simple, deterministic, reliable
    const result = analyzeCSVHeuristic(csv_text);

    if (result.contacts.length === 0) {
      console.log(`[analyze-csv] WARNING: 0 contacts extracted. Debug: ${JSON.stringify(result.debug)}`);
    }

    return res.json(result);
  } catch (err: any) {
    console.error("[analyze-csv] error:", err.message);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
});

export default router;
