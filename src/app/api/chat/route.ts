import { z } from "zod";
import { logChatEvent } from "@/lib/analytics";
import { AttachmentError, processAttachments, type ProcessedAttachments } from "@/lib/attachments";
import { getSession } from "@/lib/auth";
import { runChat, type ChatOutcome } from "@/lib/chat-engine";
import { getServerText } from "@/lib/chat-messages";
import { clientKey } from "@/lib/client-key";
import { checkRateLimit } from "@/lib/rate-limit";
import type { StreamEvent } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Запросов в минуту с одного гостя; вошедшим пользователям лимит вдвое выше. */
const RATE_LIMIT_PER_MIN = Number(process.env.CHAT_RATE_LIMIT_PER_MIN ?? 10);

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(30),
  locale: z.enum(["ru", "kk", "en"]),
  mode: z.enum(["docs", "web"]),
});

const fail = (error: string, status: number, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers });

function parseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // 1. Лимит запросов (защита квоты Gemini)
  const session = await getSession();
  const userId = session?.user?.id;
  const limit = userId ? RATE_LIMIT_PER_MIN * 2 : RATE_LIMIT_PER_MIN;
  const rate = await checkRateLimit(clientKey(req, userId), limit);
  if (!rate.ok) {
    return fail("rate_limited", 429, { "Retry-After": String(rate.retryAfter) });
  }

  // 2. Разбор и проверка запроса
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("bad_request", 400);
  }

  const parsed = bodySchema.safeParse({
    messages: parseJson(form.get("messages")),
    locale: form.get("locale"),
    mode: form.get("mode") ?? "docs",
  });
  if (!parsed.success) return fail("bad_request", 400);

  const { messages, locale, mode } = parsed.data;
  if (messages[messages.length - 1].role !== "user") return fail("bad_request", 400);

  // 3. Вложения (фото и документы)
  const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
  let attachments: ProcessedAttachments;
  try {
    attachments = await processAttachments(files);
  } catch (error) {
    if (error instanceof AttachmentError) {
      return fail(error.code, error.code === "too_large" ? 413 : 400);
    }
    console.error("[chat] Ошибка обработки вложений:", error);
    return fail("bad_request", 400);
  }

  // 4. Потоковый ответ (NDJSON: одно JSON-событие в строке)
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };

      const startedAt = Date.now();
      let outcome: ChatOutcome = { chunks: 0, webSources: 0, noData: false };
      try {
        outcome = await runChat({ history: messages, mode, locale, attachments, signal: req.signal, emit });
      } catch (error) {
        console.error("[chat] Необработанная ошибка:", error);
        emit({ type: "error", message: getServerText(locale).errors.generic });
        outcome = { ...outcome, error: "generic" };
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
      await logChatEvent({
        mode,
        locale,
        authenticated: !!userId,
        attachments: attachments.count,
        latencyMs: Date.now() - startedAt,
        outcome,
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
