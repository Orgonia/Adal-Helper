import { createHash } from "node:crypto";

/** Ключ клиента для лимитов: id пользователя или хэш IP (сам IP не храним). */
export function clientKey(req: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 16)}`;
}
