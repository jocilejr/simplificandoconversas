/**
 * Normalização determinística de e-mails.
 * Corrige erros comuns no domínio (após o @) usando dicionário de typos conhecidos.
 * NUNCA altera a parte antes do @.
 */

const DOMAIN_TYPOS: Record<string, string> = {
  // Gmail
  "gemil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.com.br": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmail.coom": "gmail.com",
  "gmaio.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "gmeil.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gimail.com": "gmail.com",
  "gemail.com": "gmail.com",
  "gmiall.com": "gmail.com",
  "gamail.com": "gmail.com",
  "gmsil.com": "gmail.com",
  "gmaiil.com": "gmail.com",
  "ggmail.com": "gmail.com",

  // Hotmail
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmeil.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotamail.com": "hotmail.com",
  "hotmali.com": "hotmail.com",
  "hotmall.com": "hotmail.com",
  "hotmaol.com": "hotmail.com",
  "homail.com": "hotmail.com",
  "hhotmail.com": "hotmail.com",
  "hotamil.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cm": "hotmail.com",
  "hotmail.comm": "hotmail.com",

  // Outlook
  "outlok.com": "outlook.com",
  "outllook.com": "outlook.com",
  "outloock.com": "outlook.com",
  "outlool.com": "outlook.com",
  "outloook.com": "outlook.com",
  "outlookk.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.cm": "outlook.com",
  "outlook.comm": "outlook.com",
  "outolok.com": "outlook.com",
  "oultook.com": "outlook.com",
  "outiook.com": "outlook.com",
  "outook.com": "outlook.com",

  // Yahoo
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yahoou.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "yahoo.comm": "yahoo.com",
  "yaho.com.br": "yahoo.com.br",

  // iCloud
  "iclould.com": "icloud.com",
  "iclod.com": "icloud.com",
  "icloude.com": "icloud.com",
  "icloud.co": "icloud.com",
  "icloud.con": "icloud.com",

  // Live
  "live.co": "live.com",
  "live.con": "live.com",
  "live.cm": "live.com",

  // UOL
  "uol.com": "uol.com.br",
  "uol.con.br": "uol.com.br",
  "uol.co.br": "uol.com.br",
  "uol.cm.br": "uol.com.br",

  // BOL
  "bol.com": "bol.com.br",
  "bol.con.br": "bol.com.br",

  // Terra
  "terra.com": "terra.com.br",
  "terra.con.br": "terra.com.br",

  // IG
  "ig.com": "ig.com.br",
  "ig.con.br": "ig.com.br",

  // Globo
  "globo.co": "globo.com",
  "globo.con": "globo.com",
  "globomail.co": "globomail.com",

  // Proton
  "protonmail.co": "protonmail.com",
  "protonmail.con": "protonmail.com",
  "protonmal.com": "protonmail.com",
};

// Domínios incompletos (sem TLD)
const INCOMPLETE_DOMAINS: Record<string, string> = {
  gmail: "gmail.com",
  hotmail: "hotmail.com",
  outlook: "outlook.com",
  yahoo: "yahoo.com",
  icloud: "icloud.com",
  live: "live.com",
  uol: "uol.com.br",
  bol: "bol.com.br",
  terra: "terra.com.br",
  ig: "ig.com.br",
  globo: "globo.com",
  protonmail: "protonmail.com",
  globomail: "globomail.com",
};

// Domínios conhecidos para detecção de @ faltando
const KNOWN_DOMAINS = [
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
];

export interface NormalizeResult {
  email: string;
  corrected: boolean;
  original: string;
}

export function normalizeEmail(input: string): NormalizeResult {
  const original = input.trim().toLowerCase();

  if (!original) {
    return { email: original, corrected: false, original };
  }

  let localPart: string;
  let domain: string;

  if (original.includes("@")) {
    const atIdx = original.indexOf("@");
    localPart = original.substring(0, atIdx);
    domain = original.substring(atIdx + 1);
  } else {
    // Sem @: tentar detectar domínio conhecido no final
    let foundDomain: string | null = null;
    for (const knownDomain of KNOWN_DOMAINS) {
      if (original.endsWith(knownDomain) && original.length > knownDomain.length) {
        foundDomain = knownDomain;
        break;
      }
    }
    // Tentar também com typos conhecidos
    if (!foundDomain) {
      for (const [typo, correct] of Object.entries(DOMAIN_TYPOS)) {
        if (original.endsWith(typo) && original.length > typo.length) {
          foundDomain = typo; // será corrigido abaixo
          break;
        }
      }
    }
    if (foundDomain) {
      localPart = original.substring(0, original.length - foundDomain.length);
      domain = foundDomain;
    } else {
      // Não conseguiu identificar — retorna como está
      return { email: original, corrected: false, original };
    }
  }

  if (!localPart || !domain) {
    return { email: original, corrected: false, original };
  }

  let correctedDomain = domain;
  let wasCorrected = !original.includes("@");

  // 1. Checar dicionário de typos
  if (DOMAIN_TYPOS[domain]) {
    correctedDomain = DOMAIN_TYPOS[domain];
    wasCorrected = true;
  }

  // 2. Checar domínio incompleto (sem TLD)
  if (!correctedDomain.includes(".") && INCOMPLETE_DOMAINS[correctedDomain]) {
    correctedDomain = INCOMPLETE_DOMAINS[correctedDomain];
    wasCorrected = true;
  }

  const finalEmail = `${localPart}@${correctedDomain}`;

  return {
    email: finalEmail,
    corrected: wasCorrected,
    original,
  };
}
