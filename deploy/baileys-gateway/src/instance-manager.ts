import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import { deleteAuthState, usePostgresAuthState } from "./auth-state";
import { pool } from "./db";
import { emitWebhook } from "./webhook-emitter";
import { jidToPhone, normalizeJid } from "./lid-resolver";

type InstanceState = {
  name: string;
  sock: WASocket | null;
  status: "connecting" | "open" | "close";
  qr: string | null; // data url png
  qrRaw: string | null;
  ownerJid: string | null;
  profilePicUrl: string | null;
  startedAt: number;
  msgStore: Map<string, proto.IWebMessageInfo>;
  reconnectTimer: NodeJS.Timeout | null;
};

const instances = new Map<string, InstanceState>();
const baseLogger = pino({ level: process.env.LOG_LEVEL || "warn" });

function getOrCreate(name: string): InstanceState {
  let inst = instances.get(name);
  if (!inst) {
    inst = {
      name,
      sock: null,
      status: "close",
      qr: null,
      qrRaw: null,
      ownerJid: null,
      profilePicUrl: null,
      startedAt: 0,
      msgStore: new Map(),
      reconnectTimer: null,
    };
    instances.set(name, inst);
  }
  return inst;
}

export function listInstances() {
  return Array.from(instances.values()).map((i) => ({
    instanceName: i.name,
    status: i.status === "open" ? "open" : i.status === "connecting" ? "connecting" : "close",
    ownerJid: i.ownerJid,
    profileName: null,
    profilePicUrl: i.profilePicUrl || null,
    integration: "WHATSAPP-BAILEYS",
  }));
}

export function getInstance(name: string): InstanceState | undefined {
  return instances.get(name);
}

export function getConnectionState(name: string) {
  const inst = instances.get(name);
  if (!inst) return { instance: { state: "close" } };
  return { instance: { state: inst.status, ownerJid: inst.ownerJid } };
}

async function handleDisconnect(inst: InstanceState, reason: number | undefined) {
  inst.status = "close";
  inst.sock = null;
  if (reason === DisconnectReason.loggedOut) {
    // sessão revogada — limpa auth e não reconecta sozinho
    await deleteAuthState(inst.name).catch(() => {});
    return;
  }
  // Reconnect com backoff curto
  if (inst.reconnectTimer) clearTimeout(inst.reconnectTimer);
  inst.reconnectTimer = setTimeout(() => {
    startInstance(inst.name).catch((e) =>
      console.warn(`[reconnect] ${inst.name}: ${e.message}`),
    );
  }, 3000);
}

export async function startInstance(name: string): Promise<InstanceState> {
  const inst = getOrCreate(name);
  if (inst.sock && inst.status !== "close") return inst;

  const { state, saveCreds } = await usePostgresAuthState(name);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baseLogger as any),
    },
    logger: baseLogger as any,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: async (key) => {
      const msg = inst.msgStore.get(key.id!);
      return msg?.message ?? undefined;
    },
  });

  inst.sock = sock;
  inst.status = "connecting";
  inst.startedAt = Date.now();
  inst.qr = null;
  inst.qrRaw = null;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      inst.qrRaw = qr;
      try {
        inst.qr = await QRCode.toDataURL(qr);
      } catch {
        inst.qr = null;
      }
      await emitWebhook("connection.update", name, {
        instance: name,
        state: "connecting",
        qrcode: { code: qr, base64: inst.qr },
      });
    }
    if (connection === "open") {
      inst.status = "open";
      inst.qr = null;
      inst.qrRaw = null;
      const rawJid = sock.user?.id || null;
      inst.ownerJid = rawJid ? jidToPhone(rawJid) : null;
      // Fetch profile picture
      try {
        inst.profilePicUrl = await sock.profilePictureUrl(rawJid!, "image");
      } catch {
        inst.profilePicUrl = null;
      }
      await emitWebhook("connection.update", name, {
        instance: name,
        state: "open",
        wuid: inst.ownerJid,
      });
    }
    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      await emitWebhook("connection.update", name, {
        instance: name,
        state: "close",
        statusReason: code,
      });
      await handleDisconnect(inst, code);
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    for (const msg of m.messages) {
      // Cache message for retry/decrypt requests
      if (msg.key?.id) {
        inst.msgStore.set(msg.key.id, msg);
        // Limit cache size to avoid memory bloat
        if (inst.msgStore.size > 1000) {
          const firstKey = inst.msgStore.keys().next().value;
          if (firstKey) inst.msgStore.delete(firstKey);
        }
      }
      try {
        const data = serializeMessage(name, msg);
        if (data) await emitWebhook("messages.upsert", name, data);
      } catch (e: any) {
        console.warn(`[messages.upsert] ${e.message}`);
      }
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const upd of updates) {
      await emitWebhook("messages.update", name, {
        keyId: upd.key?.id,
        keyRemoteJid: normalizeJid(upd.key?.remoteJid),
        keyFromMe: upd.key?.fromMe,
        status: upd.update?.status,
        instance: name,
      });
    }
  });

  sock.ev.on("groups.upsert", async (groups) => {
    for (const g of groups) {
      await emitWebhook("groups.upsert", name, normalizeGroup(g));
    }
  });

  sock.ev.on("groups.update", async (updates) => {
    for (const g of updates) {
      await emitWebhook("groups.update", name, { id: g.id, ...g });
    }
  });

  sock.ev.on("group-participants.update", async (ev) => {
    await emitWebhook("group-participants.update", name, ev);
  });

  return inst;
}

function serializeMessage(instance: string, msg: proto.IWebMessageInfo) {
  if (!msg.key || !msg.message) return null;
  const remoteJid = normalizeJid(msg.key.remoteJid);
  const message = msg.message;
  const messageType =
    Object.keys(message).find((k) => k !== "messageContextInfo") || "unknown";

  return {
    key: {
      id: msg.key.id,
      remoteJid,
      fromMe: !!msg.key.fromMe,
      participant: msg.key.participant ? normalizeJid(msg.key.participant) : undefined,
    },
    pushName: msg.pushName || "",
    message,
    messageType,
    messageTimestamp: Number(msg.messageTimestamp || 0),
    instanceId: instance,
    source: "baileys",
  };
}

function normalizeGroup(g: any) {
  return {
    id: g.id,
    subject: g.subject,
    subjectOwner: g.subjectOwner,
    subjectTime: g.subjectTime,
    creation: g.creation,
    owner: g.owner,
    desc: g.desc,
    participants: g.participants || [],
    size: g.size ?? (g.participants?.length || 0),
  };
}

export async function logoutInstance(name: string): Promise<void> {
  const inst = instances.get(name);
  if (inst?.sock) {
    try {
      await inst.sock.logout();
    } catch {}
  }
  if (inst) {
    inst.status = "close";
    inst.sock = null;
    inst.qr = null;
    inst.qrRaw = null;
    inst.ownerJid = null;
    inst.profilePicUrl = null;
    inst.msgStore.clear();
  }
  await deleteAuthState(name).catch(() => {});
}

export async function deleteInstance(name: string): Promise<void> {
  await logoutInstance(name);
  instances.delete(name);
}

export async function restartInstance(name: string): Promise<void> {
  const inst = instances.get(name);
  if (inst?.sock) {
    try {
      inst.sock.end(undefined as any);
    } catch {}
    inst.sock = null;
    inst.status = "close";
  }
  await startInstance(name);
}

/** Restaura todas as instâncias com auth state salvo no Postgres ao subir o serviço. */
export async function bootstrapInstances(): Promise<void> {
  const r = await pool.query(
    "SELECT instance_name FROM public.baileys_auth_state WHERE creds IS NOT NULL",
  );
  for (const row of r.rows) {
    try {
      await startInstance(row.instance_name);
      console.log(`[bootstrap] started ${row.instance_name}`);
    } catch (e: any) {
      console.warn(`[bootstrap] failed ${row.instance_name}: ${e.message}`);
    }
  }
}

export async function downloadMedia(name: string, msg: proto.IWebMessageInfo | any) {
  const inst = instances.get(name);
  if (!inst?.sock) throw new Error("instance not connected");
  const buffer = (await downloadMediaMessage(msg, "buffer", {}, {
    logger: baseLogger as any,
    reuploadRequest: inst.sock.updateMediaMessage,
  })) as Buffer;
  return buffer;
}

export { jidToPhone };
