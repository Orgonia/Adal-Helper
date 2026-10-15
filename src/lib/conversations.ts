import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import type { Conversation, ConversationSummary } from "@/types/chat";

/** Диалог хранится одним документом; сами файлы вложений не сохраняются. */
interface ConversationDoc {
  _id: string;
  userId: string;
  title: string;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_SAVED_MESSAGES = 100;
const MAX_LIST = 50;

export const conversationIdSchema = z.string().regex(/^[\w-]{8,64}$/);

const sourceSchema = z.object({
  kind: z.enum(["doc", "web"]).optional(),
  title: z.string().max(500),
  heading: z.string().max(500).optional(),
  source: z.string().max(2000),
  url: z.string().max(2000).optional(),
});

const messageSchema = z.object({
  id: z.string().max(64),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(40_000),
  mode: z.enum(["docs", "web"]).optional(),
  status: z.enum(["done", "error"]).optional(),
  error: z.string().max(1000).optional(),
  sources: z.array(sourceSchema).max(20).optional(),
  savedAttachments: z
    .array(z.object({ name: z.string().max(200), kind: z.enum(["image", "document"]) }))
    .max(5)
    .optional(),
});

export type StoredMessage = z.infer<typeof messageSchema>;

export const saveConversationSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_SAVED_MESSAGES),
});

async function collection() {
  return (await getDb()).collection<ConversationDoc>("conversations");
}

function makeTitle(messages: StoredMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content ?? "";
  const line = first.replace(/\s+/g, " ").trim();
  return line.length > 80 ? `${line.slice(0, 77)}…` : line || "…";
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const docs = await (await collection())
    .find({ userId }, { projection: { title: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .limit(MAX_LIST)
    .toArray();
  return docs.map((d) => ({ id: d._id, title: d.title, updatedAt: d.updatedAt.toISOString() }));
}

export async function getConversation(userId: string, id: string): Promise<Conversation | null> {
  const doc = await (await collection()).findOne({ _id: id, userId });
  if (!doc) return null;
  return {
    id: doc._id,
    title: doc.title,
    updatedAt: doc.updatedAt.toISOString(),
    messages: doc.messages,
  };
}

/** Сохраняет диалог целиком. Чужой диалог с тем же id перезаписать нельзя. */
export async function saveConversation(
  userId: string,
  id: string,
  messages: StoredMessage[],
): Promise<"ok" | "forbidden"> {
  const now = new Date();
  try {
    await (await collection()).updateOne(
      { _id: id, userId },
      {
        $set: { messages, title: makeTitle(messages), updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    return "ok";
  } catch (error) {
    // Документ с таким _id есть, но принадлежит другому пользователю
    if ((error as { code?: number }).code === 11000) return "forbidden";
    throw error;
  }
}

export async function deleteConversation(userId: string, id: string): Promise<boolean> {
  const res = await (await collection()).deleteOne({ _id: id, userId });
  return res.deletedCount > 0;
}
