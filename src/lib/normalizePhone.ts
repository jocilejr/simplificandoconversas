/**
 * Normalize a Brazilian phone number for display:
 * 1. Strip non-digits
 * 2. Remove leading zeros
 * 3. Add "55" prefix if missing
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "-";
  let phone = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith("55")) {
    phone = "55" + phone;
  }
  return phone || "-";
}
