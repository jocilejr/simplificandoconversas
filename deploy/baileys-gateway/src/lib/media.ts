import { downloadMediaMessage, WASocket } from "@whiskeysockets/baileys";
import pino from "pino";

const logger = pino({ level: "warn" });

/** Download media from a Baileys message and return as base64 string. */
export async function downloadAsBase64(
  sock: WASocket,
  message: any,
  type: "image" | "video" | "audio" | "document" | "sticker"
): Promise<string | null> {
  try {
    const buffer = await downloadMediaMessage(
      message,
      "buffer",
      {},
      { logger: logger as any, reuploadRequest: sock.updateMediaMessage }
    );
    if (!buffer || !(buffer instanceof Buffer)) return null;
    return (buffer as Buffer).toString("base64");
  } catch (err: any) {
    console.error("[media] download failed:", err?.message);
    return null;
  }
}
