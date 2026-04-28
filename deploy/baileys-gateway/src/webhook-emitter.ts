/**
 * Emite eventos no formato de webhook v2 para o backend.
 * Mantém o contrato de payloads que o backend já entende.
 */
const WEBHOOK_GLOBAL_URL =
  process.env.WEBHOOK_GLOBAL_URL || "http://backend:3001/api/webhook";
const GROUPS_WEBHOOK_URL =
  process.env.GROUPS_WEBHOOK_URL || "http://backend:3001/api/groups/webhook/events";

const GROUP_EVENTS = new Set([
  "groups.upsert",
  "groups.update",
  "group-participants.update",
]);

function pathFromEvent(event: string): string {
  // Com WEBHOOK_BY_EVENTS=true, posta em /<base>/<event-with-dashes-uppercase>
  // ex: messages.upsert -> MESSAGES_UPSERT
  return event.toUpperCase().replace(/\./g, "_").replace(/-/g, "_");
}

export async function emitWebhook(
  event: string,
  instance: string,
  data: any,
): Promise<void> {
  const isGroup = GROUP_EVENTS.has(event);
  const baseUrl = isGroup ? GROUPS_WEBHOOK_URL : WEBHOOK_GLOBAL_URL;
  // Group events go to GROUPS_WEBHOOK_URL as-is (no suffix); regular events get webhook suffix
  const url = isGroup ? baseUrl : `${baseUrl}/${pathFromEvent(event)}`;

  const body = {
    event,
    instance,
    data,
    date_time: new Date().toISOString(),
    server_url: process.env.API_URL || "",
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(
        `[webhook-emitter] ${event} -> ${url} failed ${resp.status}: ${text.substring(0, 200)}`,
      );
    }
  } catch (e: any) {
    console.warn(`[webhook-emitter] ${event} -> ${url} error: ${e.message}`);
  }
}
