import { feedbackSchema, saveFeedback } from "@/lib/analytics";
import { getSession } from "@/lib/auth";
import { clientKey } from "@/lib/client-key";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Оценка ответа: 👍 / 👎. Используется в аналитике качества. */
export async function POST(req: Request) {
  const userId = (await getSession())?.user?.id;
  const key = clientKey(req, userId);

  const rate = await checkRateLimit(`feedback:${key}`, 30);
  if (!rate.ok) return Response.json({ error: "rate_limited" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    await saveFeedback(key, parsed.data, !!userId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[feedback] Ошибка сохранения:", error);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
