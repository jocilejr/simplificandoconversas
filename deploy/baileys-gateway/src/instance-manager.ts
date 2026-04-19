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
  clearSenderKeyMemory,
  saveMessageToStore,
  getMessageFromStore,
} from "./postgres-auth-state";
import { forwardEvent } from "./event-bridge";

/** Per-instance group metadata cache (5 min TTL). Prevents Baileys from sending
 *  to a stale participant list, which causes "Aguardando mensagem" on receivers. */
type CachedMeta = { data: any; expiresAt: number };
const groupMetadataCache = new Map<string, Map<string, CachedMeta>>();
const GROUP_META_TTL_MS = 5 * 60_000;

function getMetaCache(instanceName: string): Map<string, CachedMeta> {
  let c = groupMetadataCache.get(instanceName);
  if (!c) {
    c = new Map();
    groupMetadataCache.set(instanceName, c);
  }
  return c;
}

function invalidateGroupMeta(instanceName: string, jid: string) {
  getMetaCache(instanceName).delete(jid);
}

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
  /** LRU message store: messageId → message. Used by getMessage for group retries. */
  msgStore: Map<string, any>;
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
      msgStore: new Map(),
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
    browser: Browsers.macOS("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    defaultQueryTimeoutMs: 60_000,
    getMessage: async (key) => {
      const stored = runtime.msgStore.get(key.id!);
      if (stored) return stored;
      // Fall back to persistent store (survives restarts)
      const persisted = await getMessageFromStore(instanceName, key.id!);
      if (persisted) {
        runtime.msgStore.set(key.id!, persisted);
        return persisted;
      }
      // Stub ensures the retry fires even for messages we don't have.
      return { conversation: "" };
    },
    cachedGroupMetadata: async (jid) => {
      const cache = getMetaCache(instanceName);
      const entry = cache.get(jid);
      if (entry && entry.expiresAt > Date.now()) {
        return entry.data;
      }
      cache.delete(jid);
      return undefined;
    },
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
      const wasReconnect = runtime.lastConnectedAt !== null;
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
      // On reconnects, force sender-key redistribution so group recipients can decrypt
      if (wasReconnect) {
        clearSenderKeyMemory(instanceName).catch((err) =>
          console.error(`[baileys:${instanceName}] clearSenderKeyMemory error:`, err?.message)
        );
        // Also drop stale group metadata cache
        groupMetadataCache.delete(instanceName);
      }
    }

    if (connection === "close") {
      runtime.state = "close";
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(
        `[baileys:${instanceName}] connection closed (statusCode=${statusCode}, loggedOut=${loggedOut})`
      );

      const timedOut = statusCode === DisconnectReason.timedOut;

      if (loggedOut) {
        await deleteAllAuth(instanceName).catch(() => {});
        runtime.sock = null;
        runtime.qr = null;
        instances.delete(instanceName);
      } else if (timedOut && runtime.reconnectAttempts >= 3) {
        // After 3 timeouts, clear auth state so a fresh QR is generated
        console.log(`[baileys:${instanceName}] clearing stale auth after repeated timeouts`);
        await deleteAllAuth(instanceName).catch(() => {});
        runtime.reconnectAttempts = 0;
        setTimeout(() => {
          startSocket(instanceName).catch((err) =>
            console.error(`[baileys:${instanceName}] reconnect error:`, err?.message)
          );
        }, 3_000);
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
    // Cache sent messages so getMessage can serve them on retry requests
    for (const msg of m.messages || []) {
      if (msg.key?.id && msg.message) {
        runtime.msgStore.set(msg.key.id, msg.message);
        // Persist for cross-restart retries (only outbound — inbound has fromMe=false)
        if (msg.key.fromMe) {
          saveMessageToStore(instanceName, msg.key.id, msg.message).catch(() => {});
        }
        if (runtime.msgStore.size > 500) {
          const firstKey = runtime.msgStore.keys().next().value;
          if (firstKey) runtime.msgStore.delete(firstKey);
        }
      }
    }
    forwardEvent(instanceName, "messages.upsert", m).catch(() => {});
  });

  sock.ev.on("messages.update", (m) => {
    forwardEvent(instanceName, "messages.update", m).catch(() => {});
  });

  sock.ev.on("groups.upsert", (groups) => {
    const cache = getMetaCache(instanceName);
    for (const g of groups || []) {
      if (g?.id) cache.set(g.id, { data: g, expiresAt: Date.now() + GROUP_META_TTL_MS });
    }
    forwardEvent(instanceName, "groups.upsert", groups).catch(() => {});
  });

  sock.ev.on("groups.update", (updates: any[]) => {
    for (const u of updates || []) {
      if (u?.id) invalidateGroupMeta(instanceName, u.id);
    }
    forwardEvent(instanceName, "groups.update", updates).catch(() => {});
  });

  sock.ev.on("group-participants.update", (g: any) => {
    // Membership changed → invalidate cached metadata so Baileys
    // re-fetches and redistributes sender keys to the new participant set.
    if (g?.id) invalidateGroupMeta(instanceName, g.id);
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
