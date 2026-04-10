/**
 * Normalizes Brazilian phone numbers by removing non-digits and adding country code.
 * Does NOT force the 9th digit - preserves the original format.
 */
export function normalizePhoneForMatching(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length < 8) return null;
  if (digits.length >= 10 && digits.length <= 11) {
    digits = '55' + digits;
  }
  return digits;
}

/**
 * Generates ALL possible variations of a Brazilian phone number.
 * Example: 89981340810 generates:
 * - 89981340810, 5589981340810, 8981340810, 558981340810
 */
export function generatePhoneVariations(phone: string | null | undefined): string[] {
  if (!phone) return [];
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length < 8) return [];

  const variations: Set<string> = new Set();
  variations.add(digits);

  let baseWithDDD = digits;
  if (digits.startsWith('55') && digits.length >= 12) {
    baseWithDDD = digits.slice(2);
  }

  const ddd = baseWithDDD.slice(0, 2);
  const restOfNumber = baseWithDDD.slice(2);

  let with9: string;
  let without9: string;

  if (restOfNumber.length === 9 && restOfNumber[0] === '9') {
    with9 = restOfNumber;
    without9 = restOfNumber.slice(1);
  } else if (restOfNumber.length === 8) {
    without9 = restOfNumber;
    with9 = '9' + restOfNumber;
  } else {
    variations.add(baseWithDDD);
    variations.add('55' + baseWithDDD);
    return Array.from(variations);
  }

  variations.add(ddd + without9);
  variations.add(ddd + with9);
  variations.add('55' + ddd + without9);
  variations.add('55' + ddd + with9);

  return Array.from(variations);
}

/**
 * Checks if two phone numbers represent the same customer.
 */
export function phonesMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  if (!phone1 || !phone2) return false;
  const variations1 = new Set(generatePhoneVariations(phone1));
  return generatePhoneVariations(phone2).some(v => variations1.has(v));
}

/**
 * Finds an existing member_products phone for a given input phone and product.
 * Returns the phone already saved in DB (to reuse in URL) or null if no match.
 *
 * Matching priority:
 * 1. Exact match (after stripping non-digits)
 * 2. Input 13 digits → remove 9 after DDD and compare
 * 3. Input 12 digits → add 9 after DDD and compare
 * 4. Last 8 digits match
 * 5. No match → return null (create new)
 */
export function findExistingMemberPhone(
  members: Array<{ phone: string; is_active: boolean; product_id: string }>,
  inputPhone: string,
  productId: string
): string | null {
  const digits = inputPhone.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;

  const active = members.filter(m => m.is_active && m.product_id === productId);
  if (!active.length) return null;

  // 1. Exact
  let match = active.find(m => m.phone === digits);
  if (match) return match.phone;

  // 2. Input 13 digits (55 + DDD + 9 + 8digits) → try without 9
  if (digits.length === 13 && digits.startsWith("55")) {
    const without9 = digits.slice(0, 4) + digits.slice(5);
    match = active.find(m => m.phone === without9);
    if (match) return match.phone;
  }

  // 3. Input 12 digits (55 + DDD + 8digits) → try with 9
  if (digits.length === 12 && digits.startsWith("55")) {
    const with9 = digits.slice(0, 4) + "9" + digits.slice(4);
    match = active.find(m => m.phone === with9);
    if (match) return match.phone;
  }

  // 4. Last 8 digits
  const last8 = digits.slice(-8);
  match = active.find(m => m.phone.slice(-8) === last8);
  if (match) return match.phone;

  return null;
}
