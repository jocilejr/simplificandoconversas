/**
 * Normalize a Brazilian phone number:
 * 1. Strip non-digits
 * 2. Remove leading zeros
 * 3. Add "55" prefix if missing
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let phone = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (phone.length >= 10 && phone.length <= 11) {
    phone = "55" + phone;
  }
  return phone || null;
}
