/**
 * Translates raw Baileys events into the same webhook payload shape Evolution
 * API used to POST to the backend. The backend code expects:
 *
 *   POST {WEBHOOK_URL}/{event-name-kebab}
 *   body: { event, instance, data, sender, server_url, date_time }
 *
 * Events forwarded:
 *   - messages.upsert        (incoming + locally-sent messages)
 *   - messages.update        (status changes: sent/delivered/read)
 *   - send.message           (synthetic, after we send via REST)
 *   - connection.update      (qr / open / close)
 *   - groups.upsert
 *   - group-participants.update
 *   - contacts.upsert
 */
const WEBHOOK_BASE =
  process.env.WEBHOOK_GLOBAL_URL || "http://backend:3001/api/webhook";

function eventToPath(eventName: string): string {
  // Evolution convention: dots → slashes, camelCase preserved.
  // Examples: "messages.upsert" → "/messages-upsert"
  //           "connection.update" → "/connection-update"
  return "/" + eventName.replace(/\./g, "-");
}

export async function forwardEvent(
  instanceName: string,
  eventName: string,
  data: any
): Promise<void> {
  const url = `${WEBHOOK_BASE}${eventToPath(eventName)}`;
  const payload = {
    event: eventName,
    instance: instanceName,
    data,
    server_url: process.env.API_URL || "",
    date_time: new Date().toISOString(),
    sender: "",
  };
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(
        `[event-bridge] ${eventName} ${instanceName} → ${resp.status} ${text.slice(0, 200)}`
      );
    }
  } catch (err: any) {
    console.error(
      `[event-bridge] failed to POST ${eventName} for ${instanceName}:`,
      err?.message
    );
  }
}
