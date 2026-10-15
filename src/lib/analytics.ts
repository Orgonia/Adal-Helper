import { z } from "zod";
import type { Locale } from "@/i18n/routing";
import type { ChatOutcome } from "@/lib/chat-engine";
import { getDb } from "@/lib/mongodb";
import type { ChatMode, FeedbackRating } from "@/types/chat";

/**
 * Обезличенная аналитика: тексты вопросов и ответов не сохраняются,
 * только технические показатели. Записи удаляет TTL-индекс (npm run db:index).
 */
interface ChatEventDoc {
  at: Date;
  mode: ChatMode;
  locale: Locale;
  authenticated: boolean;
  attachments: number;
  chunks: number;
  webSources: number;
  noData: boolean;
  error?: string;
  aborted?: boolean;
  latencyMs: number;
}

interface FeedbackDoc {
  _id: string;
  rating: FeedbackRating;
  mode?: ChatMode;
  locale: Locale;
  authenticated: boolean;
  at: Date;
}

export const feedbackSchema = z.object({
  messageId: z.string().regex(/^[\w-]{8,64}$/),
  rating: z.enum(["up", "down"]),
  mode: z.enum(["docs", "web"]).optional(),
  locale: z.enum(["ru", "kk", "en"]),
});

export async function logChatEvent(
  event: Omit<ChatEventDoc, "at" | keyof ChatOutcome> & { outcome: ChatOutcome },
): Promise<void> {
  const { outcome, ...rest } = event;
  try {
    await (await getDb()).collection<ChatEventDoc>("analytics").insertOne({
      ...rest,
      ...outcome,
      at: new Date(),
    });
  } catch (error) {
    // Аналитика не должна ломать чат
    console.warn("[analytics] Не удалось записать событие:", error);
  }
}

/** Повторная оценка того же ответа тем же клиентом заменяет предыдущую. */
export async function saveFeedback(
  voterKey: string,
  data: z.infer<typeof feedbackSchema>,
  authenticated: boolean,
): Promise<void> {
  await (await getDb()).collection<FeedbackDoc>("feedback").updateOne(
    { _id: `${voterKey}:${data.messageId}` },
    {
      $set: {
        rating: data.rating,
        mode: data.mode,
        locale: data.locale,
        authenticated,
        at: new Date(),
      },
    },
    { upsert: true },
  );
}

export interface StatsSummary {
  total: number;
  last24h: number;
  byMode: Record<ChatMode, number>;
  byLocale: Record<Locale, number>;
  noData: number;
  errors: number;
  authenticated: number;
  withAttachments: number;
  avgLatencyMs: number;
  daily: { day: string; count: number }[];
  feedback: { up: number; down: number };
  users: number;
  conversations: number;
  documents: { title: string; chunkCount: number; updatedAt: string }[];
}

/** Сводка за последние `days` дней для страницы /stats. */
export async function getStats(days = 30): Promise<StatsSummary> {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000);
  const dayAgo = new Date(Date.now() - 86_400_000);

  const [facet] = await db
    .collection<ChatEventDoc>("analytics")
    .aggregate<{
      totals: { total: number; last24h: number; noData: number; errors: number; authenticated: number; withAttachments: number; avgLatencyMs: number }[];
      byMode: { _id: ChatMode; count: number }[];
      byLocale: { _id: Locale; count: number }[];
      daily: { _id: string; count: number }[];
    }>([
      { $match: { at: { $gte: since } } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                last24h: { $sum: { $cond: [{ $gte: ["$at", dayAgo] }, 1, 0] } },
                noData: { $sum: { $cond: ["$noData", 1, 0] } },
                errors: { $sum: { $cond: [{ $ifNull: ["$error", false] }, 1, 0] } },
                authenticated: { $sum: { $cond: ["$authenticated", 1, 0] } },
                withAttachments: { $sum: { $cond: [{ $gt: ["$attachments", 0] }, 1, 0] } },
                avgLatencyMs: { $avg: "$latencyMs" },
              },
            },
          ],
          byMode: [{ $group: { _id: "$mode", count: { $sum: 1 } } }],
          byLocale: [{ $group: { _id: "$locale", count: { $sum: 1 } } }],
          daily: [
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$at" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ])
    .toArray();

  const feedbackRows = await db
    .collection<FeedbackDoc>("feedback")
    .aggregate<{ _id: FeedbackRating; count: number }>([
      { $match: { at: { $gte: since } } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ])
    .toArray();

  const [users, conversations, sources] = await Promise.all([
    db.collection("users").estimatedDocumentCount(),
    db.collection("conversations").estimatedDocumentCount(),
    db
      .collection<{ title: string; chunkCount: number; updatedAt: Date }>("sources")
      .find({}, { projection: { title: 1, chunkCount: 1, updatedAt: 1 } })
      .sort({ title: 1 })
      .toArray(),
  ]);

  const totals = facet?.totals[0];
  const count = <K extends string>(rows: { _id: K; count: number }[] | undefined, key: K) =>
    rows?.find((r) => r._id === key)?.count ?? 0;

  return {
    total: totals?.total ?? 0,
    last24h: totals?.last24h ?? 0,
    noData: totals?.noData ?? 0,
    errors: totals?.errors ?? 0,
    authenticated: totals?.authenticated ?? 0,
    withAttachments: totals?.withAttachments ?? 0,
    avgLatencyMs: Math.round(totals?.avgLatencyMs ?? 0),
    byMode: { docs: count(facet?.byMode, "docs"), web: count(facet?.byMode, "web") },
    byLocale: {
      ru: count(facet?.byLocale, "ru"),
      kk: count(facet?.byLocale, "kk"),
      en: count(facet?.byLocale, "en"),
    },
    daily: (facet?.daily ?? []).map((d) => ({ day: d._id, count: d.count })),
    feedback: { up: count(feedbackRows, "up"), down: count(feedbackRows, "down") },
    users,
    conversations,
    documents: sources.map((s) => ({
      title: s.title,
      chunkCount: s.chunkCount,
      updatedAt: s.updatedAt.toISOString(),
    })),
  };
}
