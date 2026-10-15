import { getSession } from "@/lib/auth";
import { listConversations } from "@/lib/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Список диалогов текущего пользователя (без сообщений). */
export async function GET() {
  const userId = (await getSession())?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    return Response.json({ conversations: await listConversations(userId) });
  } catch (error) {
    console.error("[conversations] Ошибка списка:", error);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
