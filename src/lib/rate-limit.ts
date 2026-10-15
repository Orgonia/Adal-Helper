import { getDb } from "@/lib/mongodb";

interface Bucket {
  _id: string;
  count: number;
  expireAt: Date;
}

let ttlReady: Promise<unknown> | null = null;

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

/**
 * Простой лимит запросов на базе MongoDB (на Vercel память между вызовами
 * не общая, поэтому счётчики хранятся в базе). Устаревшие записи удаляет
 * TTL-индекс. При сбое базы запрос пропускается, чтобы не ломать сервис.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec = 60,
): Promise<RateLimitResult> {
  try {
    const col = (await getDb()).collection<Bucket>("rate_limits");

    ttlReady ??= col
      .createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
      .catch(() => {
        ttlReady = null;
      });
    await ttlReady;

    const now = Date.now();
    const bucket = Math.floor(now / (windowSec * 1000));
    const windowEnd = (bucket + 1) * windowSec * 1000;

    const doc = await col.findOneAndUpdate(
      { _id: `${key}:${bucket}` },
      {
        $inc: { count: 1 },
        $setOnInsert: { expireAt: new Date(windowEnd + 60_000) },
      },
      { upsert: true, returnDocument: "after" },
    );

    const count = doc?.count ?? 1;
    return {
      ok: count <= limit,
      retryAfter: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
    };
  } catch (error) {
    console.error("[rate-limit] Проверка не удалась, пропускаю:", error);
    return { ok: true, retryAfter: 0 };
  }
}
