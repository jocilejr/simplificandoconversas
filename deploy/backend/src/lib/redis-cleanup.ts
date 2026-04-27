import net from "net";

const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

function buildResp(...args: string[]): Buffer {
  const parts = [`*${args.length}\r\n`];
  for (const a of args) parts.push(`$${Buffer.byteLength(a, "utf8")}\r\n${a}\r\n`);
  return Buffer.from(parts.join(""), "utf8");
}

function parseResp(buf: string): { done: boolean; result: string[] } {
  if (buf.startsWith("*")) {
    const nl = buf.indexOf("\r\n");
    if (nl === -1) return { done: false, result: [] };
    const count = parseInt(buf.substring(1, nl));
    if (count <= 0) return { done: true, result: [] };
    const result: string[] = [];
    let pos = nl + 2;
    for (let i = 0; i < count; i++) {
      const lineEnd = buf.indexOf("\r\n", pos);
      if (lineEnd === -1) return { done: false, result: [] };
      const len = parseInt(buf.substring(pos + 1, lineEnd));
      pos = lineEnd + 2;
      if (pos + len > buf.length) return { done: false, result: [] };
      result.push(buf.substring(pos, pos + len));
      pos += len + 2;
    }
    return { done: true, result };
  }
  if (buf.startsWith(":") || buf.startsWith("+") || buf.startsWith("-")) {
    if (buf.indexOf("\r\n") === -1) return { done: false, result: [] };
    return { done: true, result: [] };
  }
  return { done: false, result: [] };
}

async function redisExec(...args: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const s = net.createConnection(REDIS_PORT, REDIS_HOST);
    let buf = "";
    const timer = setTimeout(() => { s.destroy(); resolve([]); }, 5000);
    s.on("connect", () => s.write(buildResp(...args)));
    s.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      const { done, result } = parseResp(buf);
      if (done) { clearTimeout(timer); s.destroy(); resolve(result); }
    });
    s.on("error", () => { clearTimeout(timer); resolve([]); });
  });
}

export async function cleanBaileysKeys(label = ""): Promise<void> {
  try {
    const proto = await redisExec("KEYS", "evolution:baileys:protocol_*");
    if (proto.length > 0) {
      for (let i = 0; i < proto.length; i += 100)
        await redisExec("DEL", ...proto.slice(i, i + 100));
    }

    const retry = await redisExec("KEYS", "evolution:baileys:*");
    const retryKeys = retry.filter(k =>
      /evolution:baileys:[0-9a-f-]{36}_[0-9A-Z]+_\d+$/.test(k) ||
      /evolution:baileys:\d+@lid_\d+_/.test(k)
    );
    if (retryKeys.length > 0) {
      for (let i = 0; i < retryKeys.length; i += 100)
        await redisExec("DEL", ...retryKeys.slice(i, i + 100));
    }

    console.log(`[redis-cleanup]${label} protocol=${proto.length} retryKeys=${retryKeys.length}`);
  } catch (err: any) {
    console.error("[redis-cleanup] error:", err.message);
  }
}
