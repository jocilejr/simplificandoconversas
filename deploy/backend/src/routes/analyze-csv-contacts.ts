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
  // Matches: 2025-09-09 02:35:32.632, 09/09/2025 02:35, etc.
  if (/\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}/.test(value)) return true;
  if (/\d{2}[-/]\d{2}[-/]\d{4}[\sT]\d{2}:\d{2}/.test(value)) return true;
  // ISO dates
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  return false;
}

function isTagLike(value: string): boolean {
  if (!value || value.length > 60) return false;
  // Short categorical strings: etapa4, lead, grupo_x, campanha_y, ativo, inativo
  if (/^[a-zA-ZÀ-ÿ0-9_-]{1,40}$/.test(value)) return true;
  return false;
}

function isHumanNameLike(value: string): boolean {
  if (!value || value.length < 2 || value.length > 80) return false;
  if (value.includes("@")) return false;
  if (isTimestampLike(value)) return false;
  // Must contain at least one letter
  if (!/[a-zA-ZÀ-ÿ]/.test(value)) return false;
  // Pure numeric = not a name
  if (/^\d+$/.test(value)) return false;
  // If it's a single word with digits mixed in (etapa4, lead2) = tag, not name
  if (/^[a-zA-ZÀ-ÿ]+\d+$/.test(value)) return false;
  if (/^\d+[a-zA-ZÀ-ÿ]+$/.test(value)) return false;
  // Names usually have spaces (first + last) or are at least 3 chars
  // Single short words without spaces are more likely tags
  if (!value.includes(" ") && value.length <= 12 && /^[a-z0-9_-]+$/i.test(value)) return false;
  return true;
}

function isEmailLike(value: string): boolean {
  if (!value) return false;
  // Must have exactly one @
  const atCount = (value.match(/@/g) || []).length;
  if (atCount !== 1) return false;
  // Must not contain delimiters
  if (/[,;|\t]/.test(value)) return false;
  // Must not contain spaces
  if (/\s/.test(value)) return false;
  // Basic structure: something@something.something
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  return true;
}

// ─── CSV parser ────────────────────────────────────────────────────────────

function detectDelimiter(lines: string[]): string {
  const candidates = ["\t", ",", ";", "|"];
  const testLines = lines.slice(0, Math.min(lines.length, 10));

  let bestDelim = ",";
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = testLines.map(l => l.split(delim).length);
    const allSame = counts.every(c => c === counts[0]);
    const colCount = counts[0];
    if (colCount > 1 && allSame) {
      const score = colCount * 100;
      if (score > bestScore) { bestScore = score; bestDelim = delim; }
    } else if (colCount > 1) {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((a, b) => a + Math.abs(b - avg), 0) / counts.length;
      const score = avg - variance;
      if (score > bestScore) { bestScore = score; bestDelim = delim; }
    }
  }

  return bestDelim;
}

function hasHeaderRow(firstLine: string, delimiter: string): boolean {
  const cols = firstLine.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ""));
  // If any column contains @, it's data, not a header
  return !cols.some(c => c.includes("@"));
}

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

// ─── Column type detection ─────────────────────────────────────────────────

type ColumnType = "email" | "name" | "tag" | "timestamp" | "unknown";

function classifyColumns(dataLines: string[], delimiter: string, numCols: number): ColumnType[] {
  const sampleSize = Math.min(dataLines.length, 50);
  const colStats = Array.from({ length: numCols }, () => ({
    emailCount: 0,
    timestampCount: 0,
    nameCount: 0,
    tagCount: 0,
    total: 0,
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
      if (isTagLike(val) && !isTimestampLike(val) && !isEmailLike(val)) colStats[c].tagCount++;
    }
  }

  const types: ColumnType[] = new Array(numCols).fill("unknown");

  // 1. Find email column (highest email ratio > 0.3)
  let bestEmailIdx = -1;
  let bestEmailRatio = 0;
  for (let c = 0; c < numCols; c++) {
    const ratio = colStats[c].total > 0 ? colStats[c].emailCount / colStats[c].total : 0;
    if (ratio > bestEmailRatio && ratio > 0.3) {
      bestEmailRatio = ratio;
      bestEmailIdx = c;
    }
  }
  if (bestEmailIdx >= 0) types[bestEmailIdx] = "email";

  // 2. Classify remaining columns
  for (let c = 0; c < numCols; c++) {
    if (types[c] !== "unknown") continue;
    const s = colStats[c];
    if (s.total === 0) continue;

    const tsRatio = s.timestampCount / s.total;
    const nameRatio = s.nameCount / s.total;
    const tagRatio = s.tagCount / s.total;

    // Timestamp column: > 50% timestamps
    if (tsRatio > 0.5) {
      types[c] = "timestamp";
    }
    // Name column: > 40% human names AND higher than tag ratio
    else if (nameRatio > 0.4 && nameRatio > tagRatio) {
      types[c] = "name";
    }
    // Tag column: > 30% tags
    else if (tagRatio > 0.3) {
      types[c] = "tag";
    }
  }

  return types;
}

// ─── Heuristic analyzer ───────────────────────────────────────────────────

function analyzeCSVHeuristic(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 1) return { contacts: [], total_csv_lines: 0, mode: "heuristic" };

  const delimiter = detectDelimiter(lines);
  const headerPresent = hasHeaderRow(lines[0], delimiter);
  const dataLines = headerPresent ? lines.slice(1) : lines;

  if (dataLines.length === 0) return { contacts: [], total_csv_lines: 0, mode: "heuristic" };

  const numCols = parseCSVLine(dataLines[0], delimiter).length;
  const colTypes = classifyColumns(dataLines, delimiter, numCols);

  const emailCol = colTypes.indexOf("email");
  const nameCol = colTypes.indexOf("name");
  const tagCols = colTypes.map((t, i) => ({ t, i })).filter(x => x.t === "tag").map(x => x.i);

  console.log(`[analyze-csv] delimiter=${JSON.stringify(delimiter)}, header=${headerPresent}, lines=${dataLines.length}, cols=${numCols}`);
  console.log(`[analyze-csv] colTypes=${JSON.stringify(colTypes)}, emailCol=${emailCol}, nameCol=${nameCol}, tagCols=${JSON.stringify(tagCols)}`);

  if (emailCol === -1) {
    console.log("[analyze-csv] No email column found");
    return { contacts: [], total_csv_lines: dataLines.length, mode: "heuristic" };
  }

  const contacts: any[] = [];
  for (const line of dataLines) {
    const cols = parseCSVLine(line, delimiter);
    const rawEmail = cols[emailCol]?.trim();
    if (!rawEmail) continue;

    // Extra validation: reject if it looks like a whole CSV row
    if (/[,;|\t]/.test(rawEmail)) {
      contacts.push({ email: rawEmail, status: "invalid", reason: "contém delimitadores" });
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

  console.log(`[analyze-csv] Heuristic: ${contacts.length} contacts (valid=${contacts.filter(c => c.status === "valid").length}, corrected=${contacts.filter(c => c.status === "corrected").length}, invalid=${contacts.filter(c => c.status === "invalid").length})`);
  return { contacts, total_csv_lines: dataLines.length, mode: "heuristic" };
}

// ─── AI result validator ───────────────────────────────────────────────────

function shouldRejectAiResult(contacts: any[]): string | null {
  if (!contacts || contacts.length === 0) return "empty";
  const sample = contacts.slice(0, 20);
  let badCount = 0;
  for (const c of sample) {
    if (!c.email) { badCount++; continue; }
    if (/[,;|\t]/.test(c.email)) { badCount++; continue; }
    if (/\s/.test(c.email)) { badCount++; continue; }
    if ((c.email.match(/@/g) || []).length !== 1) { badCount++; continue; }
    if (isTimestampLike(c.email)) { badCount++; continue; }
  }
  const badRatio = badCount / sample.length;
  if (badRatio > 0.3) return `${Math.round(badRatio * 100)}% bad emails`;
  return null;
}

// ─── AI analyzer (fallback) ───────────────────────────────────────────────

async function analyzeWithAI(csvText: string) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;

  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const truncated = lines.slice(0, 500).join("\n");

  const systemPrompt = `Você é um analisador de CSV especializado em listas de contatos de e-mail.

Sua tarefa:
1. Analisar o CSV bruto e identificar automaticamente quais colunas contêm: e-mail, nome e tags
2. Extrair cada contato válido
3. Corrigir erros comuns de digitação em domínios de e-mail
4. Classificar cada contato:
   - "valid": e-mail correto
   - "corrected": e-mail tinha erro de digitação que foi corrigido
   - "invalid": e-mail inválido ou ausente
5. Se houver uma coluna que pareça ser tags, incluí-la como array de tags
6. Se não encontrar coluna de nome, usar null
7. Ignorar linhas sem e-mail válido
8. NUNCA inclua timestamps, datas ou horários no campo de tags

IMPORTANTE: 
- O campo "email" deve conter APENAS o endereço de e-mail, sem vírgulas, sem tags, sem timestamps
- Analise TODAS as linhas fornecidas
- Preserve a parte local do e-mail intacta, corrija apenas o domínio`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise este CSV e extraia os contatos:\n\n${truncated}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_contacts",
            description: "Return the analyzed contacts from the CSV",
            parameters: {
              type: "object",
              properties: {
                contacts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      email: { type: "string" },
                      name: { type: "string" },
                      tags: { type: "array", items: { type: "string" } },
                      status: { type: "string", enum: ["valid", "corrected", "invalid"] },
                      original_email: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["email", "status"],
                  },
                },
              },
              required: ["contacts"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_contacts" } },
      }),
    });

    if (!response.ok) {
      console.error("[analyze-csv] OpenAI error:", response.status, await response.text());
      return null;
    }

    const aiResult: any = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return null;

    const parsed = JSON.parse(toolCall.function.arguments);

    // Validate AI result quality
    const rejectReason = shouldRejectAiResult(parsed.contacts);
    if (rejectReason) {
      console.log(`[analyze-csv] AI result REJECTED: ${rejectReason}`);
      return null;
    }

    return { contacts: parsed.contacts, total_csv_lines: lines.length - 1, mode: "ai" };
  } catch (err: any) {
    console.error("[analyze-csv] AI error:", err.message);
    return null;
  }
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

    const lineCount = csv_text.split(/\r?\n/).filter(Boolean).length;
    console.log(`[analyze-csv] Received CSV with ${lineCount} lines`);

    const mode = process.env.CSV_ANALYZER_MODE || "auto";

    // HEURISTIC FIRST: always run the deterministic parser
    const heuristicResult = analyzeCSVHeuristic(csv_text);

    // If heuristic found an email column with results, use it
    if (heuristicResult.contacts.length > 0) {
      const validCount = heuristicResult.contacts.filter((c: any) => c.status !== "invalid").length;
      if (validCount > 0) {
        console.log(`[analyze-csv] Using HEURISTIC result: ${heuristicResult.contacts.length} contacts (${validCount} valid)`);
        return res.json(heuristicResult);
      }
    }

    // Only try AI as fallback if mode allows it and heuristic failed
    if (mode !== "heuristic") {
      console.log("[analyze-csv] Heuristic failed, trying AI fallback...");
      const aiResult = await analyzeWithAI(csv_text);
      if (aiResult) {
        console.log(`[analyze-csv] Using AI fallback: ${aiResult.contacts.length} contacts`);
        return res.json(aiResult);
      }
      console.log("[analyze-csv] AI fallback also failed");
    }

    // Return heuristic result even if empty
    console.log(`[analyze-csv] Final result: ${heuristicResult.contacts.length} contacts`);
    return res.json(heuristicResult);
  } catch (err: any) {
    console.error("[analyze-csv] error:", err.message);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
});

export default router;
