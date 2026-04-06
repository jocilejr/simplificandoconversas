/**
 * Motor de normalização de e-mails por similaridade + confiança.
 * Usa Damerau-Levenshtein para encontrar o domínio canônico mais próximo.
 * NUNCA altera a parte antes do @.
 */

// ─── Canonical providers ────────────────────────────────────────────────────

interface CanonicalDomain {
  provider: string;   // nome do provedor (ex: "gmail")
  domain: string;     // domínio completo (ex: "gmail.com")
}

const CANONICAL_DOMAINS: CanonicalDomain[] = [
  { provider: "gmail", domain: "gmail.com" },
  { provider: "hotmail", domain: "hotmail.com" },
  { provider: "hotmail", domain: "hotmail.com.br" },
  { provider: "outlook", domain: "outlook.com" },
  { provider: "outlook", domain: "outlook.com.br" },
  { provider: "yahoo", domain: "yahoo.com" },
  { provider: "yahoo", domain: "yahoo.com.br" },
  { provider: "icloud", domain: "icloud.com" },
  { provider: "live", domain: "live.com" },
  { provider: "uol", domain: "uol.com.br" },
  { provider: "bol", domain: "bol.com.br" },
  { provider: "terra", domain: "terra.com.br" },
  { provider: "ig", domain: "ig.com.br" },
  { provider: "globo", domain: "globo.com" },
  { provider: "globomail", domain: "globomail.com" },
  { provider: "protonmail", domain: "protonmail.com" },
  { provider: "msn", domain: "msn.com" },
  { provider: "aol", domain: "aol.com" },
  { provider: "zoho", domain: "zoho.com" },
  { provider: "r7", domain: "r7.com" },
];

const CANONICAL_SET = new Set(CANONICAL_DOMAINS.map(d => d.domain));

// ─── Damerau-Levenshtein distance ───────────────────────────────────────────

function damerauLevenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d: number[][] = [];
  for (let i = 0; i <= la; i++) {
    d[i] = [];
    for (let j = 0; j <= lb; j++) {
      d[i][j] = 0;
    }
  }
  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[la][lb];
}

// ─── Domain cleaning ────────────────────────────────────────────────────────

/**
 * Remove non-alpha chars from the start and non-alphanum/dot from the end.
 * Strips numeric/special prefix junk like "736gmail.com" → "gmail.com"
 * Strips trailing junk like "hotmail.com8" → "hotmail.com"
 */
function cleanDomain(raw: string): string {
  // Remove leading digits/special chars until we hit a letter
  let cleaned = raw.replace(/^[^a-z]+/, "");
  // Remove trailing chars after last valid TLD pattern
  // Valid endings: .com, .com.br, .net, .org, .edu, .io, etc.
  // Strip trailing non-alpha chars from the very end
  cleaned = cleaned.replace(/[^a-z]$/, "");
  // If it still has trailing junk after a valid-looking TLD, keep stripping
  // e.g. "gmail.comeh" -> strip after recognizing it's not a valid TLD
  return cleaned;
}

// ─── Find best matching canonical domain ────────────────────────────────────

interface MatchResult {
  domain: string;
  distance: number;
  confidence: number;
}

function findBestMatch(inputDomain: string): MatchResult | null {
  // Step 1: Clean domain of obvious junk (prefix digits, trailing non-alpha)
  const cleaned = cleanDomain(inputDomain);

  // Try matching against each canonical domain
  const candidates: { domain: string; dist: number }[] = [];

  for (const cd of CANONICAL_DOMAINS) {
    // Try with raw input
    const distRaw = damerauLevenshtein(inputDomain, cd.domain);
    // Try with cleaned input
    const distClean = damerauLevenshtein(cleaned, cd.domain);
    const dist = Math.min(distRaw, distClean);
    candidates.push({ domain: cd.domain, dist });
  }

  // Sort by distance
  candidates.sort((a, b) => a.dist - b.dist);

  if (candidates.length === 0) return null;

  const best = candidates[0];
  const secondBest = candidates.length > 1 ? candidates[1] : null;

  // Confidence: based on distance relative to domain length and gap to second best
  const maxLen = Math.max(inputDomain.length, best.domain.length);
  const similarity = 1 - best.dist / maxLen;

  // Gap between best and second best match
  const gap = secondBest ? secondBest.dist - best.dist : best.dist;

  // Calculate confidence score (0-1)
  let confidence = 0;
  if (best.dist === 0) {
    confidence = 1; // exact match
  } else if (best.dist <= 1 && gap >= 1) {
    confidence = 0.95;
  } else if (best.dist <= 2 && gap >= 2) {
    confidence = 0.9;
  } else if (best.dist <= 2 && gap >= 1) {
    confidence = 0.85;
  } else if (best.dist <= 3 && gap >= 2 && similarity >= 0.7) {
    confidence = 0.8;
  } else if (best.dist <= 3 && gap >= 1 && similarity >= 0.65) {
    confidence = 0.7;
  } else if (best.dist <= 4 && gap >= 2 && similarity >= 0.6) {
    confidence = 0.6;
  } else if (similarity >= 0.5) {
    confidence = 0.4;
  } else {
    confidence = 0.2;
  }

  return { domain: best.domain, distance: best.dist, confidence };
}

// ─── Result types ───────────────────────────────────────────────────────────

export type NormalizeStatus = "exact" | "corrected" | "ambiguous" | "invalid";

export interface NormalizeResult {
  email: string;
  status: NormalizeStatus;
  corrected: boolean;    // backward compat
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
    // No @: try to find a canonical domain embedded in the string
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

  // Remove trailing dots from domain
  domain = domain.replace(/\.+$/, "");

  // If domain is already a known canonical domain, it's exact
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

  // Check if it looks like a real corporate/custom domain (has valid structure)
  if (isLikelyValidCustomDomain(domain)) {
    return { email: `${localPart}@${domain}`, status: "exact", corrected: false, original, confidence: 1, reason: "domínio corporativo" };
  }

  // Try to find the best matching canonical domain
  const match = findBestMatch(domain);

  if (!match) {
    return { email: `${localPart}@${domain}`, status: "ambiguous", corrected: false, original, confidence: 0, reason: "sem correspondência" };
  }

  if (match.distance === 0) {
    // Already correct (shouldn't reach here due to CANONICAL_SET check, but safety)
    return { email: `${localPart}@${match.domain}`, status: "exact", corrected: false, original, confidence: 1 };
  }

  if (match.confidence >= 0.7) {
    return {
      email: `${localPart}@${match.domain}`,
      status: "corrected",
      corrected: true,
      original,
      confidence: match.confidence,
      reason: `${domain} → ${match.domain} (confiança ${Math.round(match.confidence * 100)}%)`,
    };
  }

  if (match.confidence >= 0.4) {
    return {
      email: `${localPart}@${domain}`,
      status: "ambiguous",
      corrected: false,
      original,
      confidence: match.confidence,
      reason: `possível ${match.domain}, mas confiança baixa (${Math.round(match.confidence * 100)}%)`,
    };
  }

  return {
    email: `${localPart}@${domain}`,
    status: "ambiguous",
    corrected: false,
    original,
    confidence: match.confidence,
    reason: `domínio não reconhecido`,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Try to infer where the @ should be when it's missing.
 * Looks for canonical domains (or close matches) embedded at the end.
 */
function inferMissingAt(str: string): { local: string; domain: string } | null {
  // Try exact canonical domains first
  for (const cd of CANONICAL_DOMAINS) {
    if (str.endsWith(cd.domain) && str.length > cd.domain.length) {
      return { local: str.substring(0, str.length - cd.domain.length), domain: cd.domain };
    }
  }

  // Try fuzzy: for each canonical domain, check if the tail of the string is close
  // Test suffixes of decreasing length
  const bestResults: { local: string; domain: string; dist: number }[] = [];

  for (const cd of CANONICAL_DOMAINS) {
    const domLen = cd.domain.length;
    // Try tail with same length ± 3
    for (let offset = -3; offset <= 3; offset++) {
      const tryLen = domLen + offset;
      if (tryLen <= 0 || tryLen >= str.length) continue;
      const tail = str.substring(str.length - tryLen);
      const dist = damerauLevenshtein(tail, cd.domain);
      if (dist <= 3 && dist / cd.domain.length <= 0.3) {
        bestResults.push({
          local: str.substring(0, str.length - tryLen),
          domain: cd.domain,
          dist,
        });
      }
    }
  }

  if (bestResults.length === 0) return null;
  bestResults.sort((a, b) => a.dist - b.dist);
  const best = bestResults[0];
  if (best.local.length > 0) {
    return { local: best.local, domain: best.domain };
  }
  return null;
}

/**
 * Check if a domain looks like a valid corporate/custom domain.
 * Must have at least one dot, a valid-looking TLD, and no obvious junk.
 */
function isLikelyValidCustomDomain(domain: string): boolean {
  // Must have at least one dot
  if (!domain.includes(".")) return false;

  const parts = domain.split(".");
  const tld = parts[parts.length - 1];

  // Valid TLDs are 2-6 alpha chars
  if (!/^[a-z]{2,6}$/.test(tld)) return false;

  // For .br domains, check second-level
  if (tld === "br" && parts.length >= 3) {
    const sld = parts[parts.length - 2];
    if (!/^[a-z]{2,4}$/.test(sld)) return false;
  }

  // Provider name should be all alpha (no digits jammed in)
  const providerPart = parts[0];
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(providerPart) && providerPart.length > 1) return false;
  if (providerPart.length === 1 && !/^[a-z]$/.test(providerPart)) return false;

  // Check it's not a mangled version of a known provider
  // If distance to any canonical domain is very small, it's NOT a valid custom domain
  for (const cd of CANONICAL_DOMAINS) {
    const dist = damerauLevenshtein(domain, cd.domain);
    if (dist > 0 && dist <= 2) return false; // too close to a known provider = likely a typo
  }

  return true;
}
