/**
 * Multi-instance Baileys manager.
 *
 * Holds one WASocket per instance name. Auth state is persisted in Postgres
 * so the gateway survives restarts without losing sessions.
 *
 * Public API:
 *   getOrCreate(instanceName)  → ensures a socket exists (creates if missing)
 *   get(instanceName)          → returns the socket or null
 *   getQR(instanceName)        → returns last QR (data URL) if any
 *   getState(instanceName)     → "open" | "connecting" | "close"
 *   logout(instanceName)       → terminates session, wipes auth, deletes from memory
 *   destroy(instanceName)      → like logout but called on deletion
 */
import makeWASocket, {
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import {
  usePostgresAuthState,
  deleteAllAuth,
  listInstanceNames,
} from "./postgres-auth-state";
import { forwardEvent } from "./event-bridge";

type InstanceRuntime = {
  name: string;
  sock: WASocket | null;
  qr: string | null; // data URL
  state: "open" | "connecting" | "close";
  lastConnectedAt: number | null;
  reconnectAttempts: number;
  ownerJid: string;
  profileName: string;
  profilePicUrl: string;
};

const instances = new Map<string, InstanceRuntime>();
const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || "warn" });

function getRuntime(instanceName: string): InstanceRuntime {
  let r = instances.get(instanceName);
  if (!r) {
    r = {
      name: instanceName,
      sock: null,
      qr: null,
      state: "close",
      lastConnectedAt: null,
      reconnectAttempts: 0,
      ownerJid: "",
      profileName: "",
      profilePicUrl: "",
    };
    instances.set(instanceName, r);
  }
  return r;
}

export function getInstance(instanceName: string): InstanceRuntime | null {
  return instances.get(instanceName) || null;
}

export function listAllInstances(): InstanceRuntime[] {
  return Array.from(instances.values());
}

async function startSocket(instanceName: string): Promise<WASocket> {
  const runtime = getRuntime(instanceName);
  const { state, saveCreds } = await usePostgresAuthState(instanceName);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: logger as any,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
  });

  runtime.sock = sock;
  runtime.state = "connecting";

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        runtime.qr = await QRCode.toDataURL(qr);
      } catch (err: any) {
        console.error(`[baileys:${instanceName}] qr encode error:`, err?.message);
      }
    }

    if (connection === "open") {
      runtime.state = "open";
      runtime.qr = null;
      runtime.lastConnectedAt = Date.now();
      runtime.reconnectAttempts = 0;
      const me = sock.user;
      runtime.ownerJid = me?.id?.split(":")[0] + "@s.whatsapp.net" || "";
      runtime.profileName = me?.name || me?.verifiedName || "";
      console.log(
        `[baileys:${instanceName}] connected as ${runtime.ownerJid}`
      );
      // Try to fetch profile pic (best effort)
      try {
        if (me?.id) {
          runtime.profilePicUrl =
            (await sock.profilePictureUrl(me.id, "image").catch(() => "")) || "";
        }
      } catch {}
    }

    if (connection === "close") {
      runtime.state = "close";
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(
        `[baileys:${instanceName}] connection closed (statusCode=${statusCode}, loggedOut=${loggedOut})`
      );

      if (loggedOut) {
        await deleteAllAuth(instanceName).catch(() => {});
        runtime.sock = null;
        runtime.qr = null;
        instances.delete(instanceName);
      } else {
        // Reconnect with exponential backoff (cap 60s)
        runtime.reconnectAttempts += 1;
        const delay = Math.min(60_000, 2_000 * Math.pow(2, Math.min(runtime.reconnectAttempts, 5)));
        setTimeout(() => {
          startSocket(instanceName).catch((err) =>
            console.error(`[baileys:${instanceName}] reconnect error:`, err?.message)
          );
        }, delay);
      }
    }

    // Forward to backend in Evolution-compatible shape
    forwardEvent(instanceName, "connection.update", {
      state: connection || runtime.state,
      qr: runtime.qr,
      statusReason: (lastDisconnect?.error as Boom)?.output?.statusCode,
    }).catch(() => {});
  });

  sock.ev.on("messages.upsert", (m) => {
    forwardEvent(instanceName, "messages.upsert", m).catch(() => {});
  });

  sock.ev.on("messages.update", (m) => {
    forwardEvent(instanceName, "messages.update", m).catch(() => {});
  });

  sock.ev.on("groups.upsert", (groups) => {
    forwardEvent(instanceName, "groups.upsert", groups).catch(() => {});
  });

  sock.ev.on("group-participants.update", (g) => {
    forwardEvent(instanceName, "group-participants.update", g).catch(() => {});
  });

  sock.ev.on("contacts.upsert", (c) => {
    forwardEvent(instanceName, "contacts.upsert", c).catch(() => {});
  });

  return sock;
}

export async function getOrCreate(instanceName: string): Promise<InstanceRuntime> {
  const runtime = getRuntime(instanceName);
  if (!runtime.sock || runtime.state === "close") {
    await startSocket(instanceName);
  }
  return runtime;
}

export async function logout(instanceName: string): Promise<void> {
  const runtime = instances.get(instanceName);
  try {
    await runtime?.sock?.logout().catch(() => {});
  } catch {}
  await deleteAllAuth(instanceName).catch(() => {});
  instances.delete(instanceName);
}

export async function destroy(instanceName: string): Promise<void> {
  await logout(instanceName);
}

export async function bootstrapExistingInstances(): Promise<void> {
  const names = await listInstanceNames();
  console.log(`[baileys] bootstrapping ${names.length} existing instance(s)`);
  for (const name of names) {
    try {
      await startSocket(name);
    } catch (err: any) {
      console.error(`[baileys] bootstrap ${name} failed:`, err?.message);
    }
  }
}
