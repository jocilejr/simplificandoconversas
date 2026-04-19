/**
 * Multi-instance Baileys manager.
 *
 * Aligned with the proven jocilejr/whats-grupos reference gateway:
 *  - No `getMessage` callback (returning empty stubs causes "Aguardando mensagem"
 *    on recipients indefinitely; letting WA handle retries is the correct behavior).
 *  - No `cachedGroupMetadata` (Baileys fetches live with an internal timeout —
 *    stale cached metadata also caused undelivered group messages).
 *  - Pinned WhatsApp Web version (matches the reference, more stable than
 *    `fetchLatestBaileysVersion` which can land on broken builds).
 *  - Simple backoff reconnect (5s, 15s, 60s) on non-fatal disconnects.
 *  - Custom browser identifier string (Evolution API style).
 *
 * Differences from the reference (kept on purpose for our infra):
 *  - Auth state lives in Postgres, not on disk (multi-replica safe).
 *  - Webhook bridge fans events to the backend.
 *  - Multi-instance manager exposes runtime info to /instance routes.
 */
import makeWASocket, {
  DisconnectReason,
  WASocket,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import {
  usePostgresAuthState,
  deleteAllAuth,
  listInstanceNames,
  saveMessageToStore,
  getMessageFromStore,
} from "./postgres-auth-state";
import { forwardEvent } from "./event-bridge";

// Pinned WhatsApp Web version — matches the reference gateway (proven stable).
// Updating this requires testing; do not switch back to fetchLatestBaileysVersion
// without verifying group delivery still works.
const WA_VERSION: [number, number, number] = [2, 3000, 1033893291];

// Backoff schedule for reconnection on transient disconnects.
const RECONNECT_DELAYS_MS = [5_000, 15_000, 60_000];

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

  const sock = makeWASocket({
    version: WA_VERSION,
    auth: state,
    logger: logger as any,
    printQRInTerminal: false,
    browser: Browsers.appropriate("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    defaultQueryTimeoutMs: 60_000,
    getMessage: async (key) => {
      // Return real sent message so WA can re-encrypt with fresh sender key on retry.
      // Returning undefined is correct when unknown (NOT an empty stub which causes
      // "aguardando mensagem" by delivering an empty message to the recipient).
      const inMemory = runtime.msgStore.get(key.id!);
      if (inMemory) return inMemory;
      return await getMessageFromStore(instanceName, key.id!) || undefined;
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
        console.log(`[baileys:${instanceName}] QR generated`);
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
      console.log(`[baileys:${instanceName}] CONNECTED as=${runtime.ownerJid}`);
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
      const reasonName =
        Object.entries(DisconnectReason).find(([, v]) => v === statusCode)?.[0] || "unknown";
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(
        `[baileys:${instanceName}] connection closed status=${statusCode} reason=${reasonName} loggedOut=${loggedOut}`
      );

      // Drop dead socket reference; let GC handle the rest.
      runtime.sock = null;

      // Terminal codes — only truly fatal disconnects should wipe auth.
      // 440 (connectionReplaced) must NOT wipe auth: it happens during service
      // updates when the new container connects before the old one stops.
      const terminalCodes: number[] = [
        DisconnectReason.loggedOut, // 401
        DisconnectReason.multideviceMismatch, // 411
      ];

      if (loggedOut || (statusCode && terminalCodes.includes(statusCode))) {
        console.warn(
          `[baileys:${instanceName}] terminal disconnect (${statusCode}) — wiping auth`
        );
        await deleteAllAuth(instanceName).catch(() => {});
        runtime.qr = null;
        instances.delete(instanceName);
      } else {
        // Backoff reconnect: 5s, 15s, 60s, then keep retrying every 60s.
        const attempt = runtime.reconnectAttempts;
        const delay =
          RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
        runtime.reconnectAttempts = attempt + 1;
        console.log(
          `[baileys:${instanceName}] reconnect scheduled attempt=${attempt + 1} in ${delay}ms`
        );
        setTimeout(() => {
          startSocket(instanceName).catch((err) =>
            console.error(`[baileys:${instanceName}] reconnect error:`, err?.message)
          );
        }, delay);
      }
    }

    forwardEvent(instanceName, "connection.update", {
      state: connection || runtime.state,
      qr: runtime.qr,
      statusReason: (lastDisconnect?.error as Boom)?.output?.statusCode,
    }).catch(() => {});
  });

  // Forward inbound/outbound messages to the backend (unchanged contract).
  sock.ev.on("messages.upsert", (m) => {
    // Cache sent messages so getMessage returns real content on WA retry requests
    for (const msg of m.messages || []) {
      if (msg.key?.id && msg.message) {
        runtime.msgStore.set(msg.key.id, msg.message);
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
    forwardEvent(instanceName, "groups.upsert", groups).catch(() => {});
  });

  sock.ev.on("groups.update", (updates: any[]) => {
    forwardEvent(instanceName, "groups.update", updates).catch(() => {});
  });

  sock.ev.on("group-participants.update", (g: any) => {
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
  try {
    runtime?.sock?.end(undefined as any);
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
