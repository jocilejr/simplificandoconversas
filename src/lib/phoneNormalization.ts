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
