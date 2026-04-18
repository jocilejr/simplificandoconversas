/**
 * Helpers shared by all routes.
 */
import type { Request, Response, NextFunction } from "express";

const API_KEY = process.env.BAILEYS_API_KEY || process.env.EVOLUTION_API_KEY || "";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers["apikey"] || req.headers["x-api-key"]) as string | undefined;
  if (!API_KEY) return next(); // no key configured → allow (dev only)
  if (key !== API_KEY) {
    return res.status(401).json({ status: 401, error: "Unauthorized" });
  }
  next();
}

/** Normalize a phone-number-or-jid into a full WhatsApp JID. */
export function toJid(input: string): string {
  if (!input) return "";
  if (input.includes("@")) return input;
  const digits = input.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

/** Normalize a group jid (must end with @g.us). */
export function toGroupJid(input: string): string {
  if (!input) return "";
  if (input.endsWith("@g.us")) return input;
  const digits = input.replace(/\D/g, "");
  return `${digits}@g.us`;
}
