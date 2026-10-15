import { getSession } from "@/lib/auth";
import {
  conversationIdSchema,
  deleteConversation,
  getConversation,
  saveConversation,
  saveConversationSchema,
} from "@/lib/conversations";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Общая проверка: пользователь вошёл и id диалога корректен. */
async function resolve(ctx: Context): Promise<{ userId: string; id: string } | Response> {
  const userId = (await getSession())?.user?.id;
  if (!userId) return fail("unauthorized", 401);
  const id = conversationIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("bad_request", 400);
  return { userId, id: id.data };
}

export async function GET(_req: Request, ctx: Context) {
  const r = await resolve(ctx);
  if (r instanceof Response) return r;
  try {
    const conversation = await getConversation(r.userId, r.id);
    return conversation ? Response.json({ conversation }) : fail("not_found", 404);
  } catch (error) {
    console.error("[conversations] Ошибка чтения:", error);
    return fail("server", 500);
  }
}

export async function PUT(req: Request, ctx: Context) {
  const r = await resolve(ctx);
  if (r instanceof Response) return r;

  const rate = await checkRateLimit(`save:${r.userId}`, 60);
  if (!rate.ok) return fail("rate_limited", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }
  const parsed = saveConversationSchema.safeParse(body);
  if (!parsed.success) return fail("bad_request", 400);

  try {
    const result = await saveConversation(r.userId, r.id, parsed.data.messages);
    return result === "ok" ? Response.json({ ok: true }) : fail("forbidden", 403);
  } catch (error) {
    console.error("[conversations] Ошибка сохранения:", error);
    return fail("server", 500);
  }
}

export async function DELETE(_req: Request, ctx: Context) {
  const r = await resolve(ctx);
  if (r instanceof Response) return r;
  try {
    return (await deleteConversation(r.userId, r.id)) ? Response.json({ ok: true }) : fail("not_found", 404);
  } catch (error) {
    console.error("[conversations] Ошибка удаления:", error);
    return fail("server", 500);
  }
}
