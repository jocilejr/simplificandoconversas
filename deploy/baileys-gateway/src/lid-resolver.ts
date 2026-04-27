/**
 * Política de @lid (mem://tech/lid-management-comprehensive):
 * identificadores @lid são temporários e devem ser convertidos para o JID real
 * antes de emitir webhooks. Quando não há mapeamento conhecido, mantemos o JID
 * intacto (o backend já tem lógica para descartar/atualizar registros @lid).
 */
export function normalizeJid(jid?: string | null): string {
  if (!jid) return "";
  // Mantém grupos como estão.
  if (jid.endsWith("@g.us")) return jid;
  if (jid.endsWith("@s.whatsapp.net")) return jid;
  if (jid.endsWith("@lid")) return jid; // backend faz a higienização
  return jid;
}

export function jidToPhone(jid?: string | null): string {
  if (!jid) return "";
  const base = jid.split("@")[0] || "";
  return base.split(":")[0] || "";
}
