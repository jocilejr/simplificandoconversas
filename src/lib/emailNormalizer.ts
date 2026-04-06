/**
 * Motor de normalização de e-mails por similaridade + confiança.
 * Usa Damerau-Levenshtein para encontrar o domínio canônico mais próximo.
 * NUNCA altera a parte antes do @.
 */

// ─── Canonical providers ────────────────────────────────────────────────────

const CANONICAL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "live.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "globomail.com",
  "protonmail.com",
  "msn.com",
  "aol.com",
  "zoho.com",
  "r7.com",
];

const CANONICAL_SET = new Set(CANONICAL_DOMAINS);

// Known aliases: domains that look valid but should be mapped to the canonical
const KNOWN_ALIASES: Record<string, string> = {
  "gmail.com.br": "gmail.com",
  "gm.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "outloo.com": "outlook.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "uol.com": "uol.com.br",
  "bol.com": "bol.com.br",
  "terra.com": "terra.com.br",
  "ig.com": "ig.com.br",
};

// ─── Damerau-Levenshtein distance ───────────────────────────────────────────

function damerauLevenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d: number[][] = [];
  for (let i = 0; i <= la; i++) {
    d[i] = new Array(lb + 1).fill(0);
  }
  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[la][lb];
}

// ─── Domain cleaning ────────────────────────────────────────────────────────

/**
 * Remove non-alpha prefix (digits, special chars) and trailing non-alpha chars.
 * "736gmail.com.br" → "gmail.com.br"
 * "hotmail.com8" → "hotmail.com"
 */
function cleanDomain(raw: string): string {
  // Remove leading non-alpha
  let cleaned = raw.replace(/^[^a-z]+/, "");
  // Remove trailing non-alpha (digits, special)
  cleaned = cleaned.replace(/[^a-z.]+$/, "");
  // Remove trailing dots
  cleaned = cleaned.replace(/\.+$/, "");
  return cleaned;
}

// ─── Find best matching canonical domain ────────────────────────────────────

interface MatchCandidate {
  domain: string;
  dist: number;
  usedCleaned: boolean;
}

function findBestMatch(inputDomain: string): {
  domain: string;
  distance: number;
  confidence: number;
  wasCleaned: boolean;
} | null {
  const cleaned = cleanDomain(inputDomain);
  const candidates: MatchCandidate[] = [];

  for (const cd of CANONICAL_DOMAINS) {
    const distRaw = damerauLevenshtein(inputDomain, cd);
    const distClean = damerauLevenshtein(cleaned, cd);
    const usedCleaned = distClean < distRaw;
    const dist = Math.min(distRaw, distClean);
    candidates.push({ domain: cd, dist, usedCleaned });
  }

  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates.length === 0) return null;

  const best = candidates[0];
  const secondBest = candidates.length > 1 ? candidates[1] : null;
  const gap = secondBest ? secondBest.dist - best.dist : best.dist + 2;
  const maxLen = Math.max(inputDomain.length, best.domain.length);
  const similarity = 1 - best.dist / maxLen;

  let confidence: number;
  if (best.dist === 0) {
    confidence = 1;
  } else if (best.dist === 1 && gap >= 1) {
    confidence = 0.95;
  } else if (best.dist <= 2 && gap >= 2) {
    confidence = 0.9;
  } else if (best.dist <= 2 && gap >= 1) {
    confidence = 0.85;
  } else if (best.dist <= 3 && gap >= 2 && similarity >= 0.65) {
    confidence = 0.8;
  } else if (best.dist <= 3 && gap >= 1 && similarity >= 0.6) {
    confidence = 0.75;
  } else if (best.dist <= 4 && gap >= 2 && similarity >= 0.6) {
    confidence = 0.65;
  } else if (best.dist <= 4 && gap >= 1 && similarity >= 0.55) {
    confidence = 0.55;
  } else if (similarity >= 0.5) {
    confidence = 0.4;
  } else {
    confidence = 0.2;
  }

  return {
    domain: best.domain,
    distance: best.dist,
    confidence,
    wasCleaned: best.usedCleaned,
  };
}

// ─── Result types ───────────────────────────────────────────────────────────

export type NormalizeStatus = "exact" | "corrected" | "ambiguous" | "invalid";

export interface NormalizeResult {
  email: string;
  status: NormalizeStatus;
  corrected: boolean;
  original: string;
  confidence: number;
  reason?: string;
}

// ─── Main normalizer ────────────────────────────────────────────────────────

export function normalizeEmail(input: string): NormalizeResult {
  const original = input.trim().toLowerCase().replace(/\s+/g, "");

  if (!original) {
    return { email: original, status: "invalid", corrected: false, original, confidence: 0, reason: "vazio" };
  }

  let localPart: string;
  let domain: string;

  if (original.includes("@")) {
    const atIdx = original.indexOf("@");
    localPart = original.substring(0, atIdx);
    domain = original.substring(atIdx + 1);
  } else {
    const inferred = inferMissingAt(original);
    if (inferred) {
      localPart = inferred.local;
      domain = inferred.domain;
    } else {
      return { email: original, status: "invalid", corrected: false, original, confidence: 0, reason: "sem @ e domínio não reconhecido" };
    }
  }

  if (!localPart || !domain) {
    return { email: original, status: "invalid", corrected: false, original, confidence: 0, reason: "parte local ou domínio vazio" };
  }

  // Clean trailing dots
  domain = domain.replace(/\.+$/, "");

  // Clean junk from domain (leading digits, trailing non-alpha)
  const cleanedDomain = cleanDomain(domain);

  // Check known aliases first (uol.com → uol.com.br, etc.)
  const aliasKey = KNOWN_ALIASES[domain] ? domain : KNOWN_ALIASES[cleanedDomain] ? cleanedDomain : null;
  if (aliasKey) {
    const target = KNOWN_ALIASES[aliasKey];
    return {
      email: `${localPart}@${target}`,
      status: "corrected",
      corrected: true,
      original,
      confidence: 1,
      reason: `${domain} → ${target}`,
    };
  }

  // If domain is already canonical, it's exact
  if (CANONICAL_SET.has(domain)) {
    const finalEmail = `${localPart}@${domain}`;
    const wasChanged = finalEmail !== original;
    return {
      email: finalEmail,
      status: wasChanged ? "corrected" : "exact",
      corrected: wasChanged,
      original,
      confidence: 1,
      reason: wasChanged ? "@ inserido" : undefined,
    };
  }

  // Try similarity match
  const match = findBestMatch(domain);

  if (!match) {
    return { email: `${localPart}@${domain}`, status: "ambiguous", corrected: false, original, confidence: 0, reason: "sem correspondência" };
  }

  // Exact match (after cleaning) — this means the domain had junk chars
  if (match.distance === 0 && domain !== match.domain) {
    return {
      email: `${localPart}@${match.domain}`,
      status: "corrected",
      corrected: true,
      original,
      confidence: 1,
      reason: `limpeza: ${domain} → ${match.domain}`,
    };
  }

  // Already correct
  if (match.distance === 0) {
    return { email: `${localPart}@${match.domain}`, status: "exact", corrected: false, original, confidence: 1 };
  }

  // High confidence correction
  if (match.confidence >= 0.7) {
    return {
      email: `${localPart}@${match.domain}`,
      status: "corrected",
      corrected: true,
      original,
      confidence: match.confidence,
      reason: `${domain} → ${match.domain} (${Math.round(match.confidence * 100)}%)`,
    };
  }

  // Check if it's a valid-looking custom/corporate domain before marking ambiguous
  if (isLikelyValidCustomDomain(domain, match)) {
    return { email: `${localPart}@${domain}`, status: "exact", corrected: false, original, confidence: 1, reason: "domínio corporativo" };
  }

  if (match.confidence >= 0.4) {
    return {
      email: `${localPart}@${domain}`,
      status: "ambiguous",
      corrected: false,
      original,
      confidence: match.confidence,
      reason: `possível ${match.domain} (${Math.round(match.confidence * 100)}%)`,
    };
  }

  // Low confidence — check if it could be a valid domain anyway
  if (hasValidStructure(domain)) {
    return { email: `${localPart}@${domain}`, status: "exact", corrected: false, original, confidence: 0.5, reason: "domínio desconhecido mas estrutura válida" };
  }

  return {
    email: `${localPart}@${domain}`,
    status: "ambiguous",
    corrected: false,
    original,
    confidence: match.confidence,
    reason: "domínio não reconhecido",
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function inferMissingAt(str: string): { local: string; domain: string } | null {
  // Try exact canonical domains first
  for (const cd of CANONICAL_DOMAINS) {
    if (str.endsWith(cd) && str.length > cd.length) {
      return { local: str.substring(0, str.length - cd.length), domain: cd };
    }
  }

  // Try fuzzy match on tail
  const results: { local: string; domain: string; dist: number }[] = [];
  for (const cd of CANONICAL_DOMAINS) {
    const domLen = cd.length;
    for (let offset = -3; offset <= 3; offset++) {
      const tryLen = domLen + offset;
      if (tryLen <= 0 || tryLen >= str.length) continue;
      const tail = str.substring(str.length - tryLen);
      const dist = damerauLevenshtein(tail, cd);
      if (dist <= 3 && dist / cd.length <= 0.3) {
        results.push({ local: str.substring(0, str.length - tryLen), domain: cd, dist });
      }
    }
  }

  if (results.length === 0) return null;
  results.sort((a, b) => a.dist - b.dist);
  const best = results[0];
  return best.local.length > 0 ? { local: best.local, domain: best.domain } : null;
}

/**
 * Check if a domain is likely a valid corporate/custom domain.
 * Only returns true if it's far enough from all canonical domains.
 */
function isLikelyValidCustomDomain(
  domain: string,
  bestMatch: { distance: number; confidence: number }
): boolean {
  if (!hasValidStructure(domain)) return false;
  // If it's close to a canonical domain, it's likely a typo, not a real domain
  if (bestMatch.distance <= 4) return false;
  return true;
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
  if (provider.length === 0) return false;
  if (!/^[a-z]/.test(provider)) return false;
  return true;
}
