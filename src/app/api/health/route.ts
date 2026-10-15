import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Проверка работоспособности для мониторинга: база отвечает, ключ Gemini задан. */
export async function GET() {
  const checks = { database: false, gemini: !!process.env.GEMINI_API_KEY };
  try {
    await (await getDb()).command({ ping: 1 });
    checks.database = true;
  } catch {
    /* база недоступна */
  }
  const ok = checks.database && checks.gemini;
  return Response.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
