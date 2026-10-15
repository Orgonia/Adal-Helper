import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getStats, type StatsSummary } from "@/lib/analytics";
import { getSession, isAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false } };

function percent(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate text-zinc-400">{r.label}</span>
          <span className="h-2 rounded-full bg-white/5">
            <span className="block h-2 rounded-full bg-sky-400" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-zinc-300">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function StatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Страница доступна только администраторам из ADMIN_EMAILS
  const session = await getSession();
  if (!isAdminEmail(session?.user?.email)) notFound();

  const t = await getTranslations("stats");
  let stats: StatsSummary;
  try {
    stats = await getStats(30);
  } catch (error) {
    console.error("[stats] Ошибка:", error);
    return <main className="mx-auto max-w-4xl px-4 py-10 text-red-300">{t("error")}</main>;
  }

  const rated = stats.feedback.up + stats.feedback.down;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t("subtitle")}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={t("requests")} value={stats.total} hint={t("last24h", { count: stats.last24h })} />
        <Tile label={t("noData")} value={percent(stats.noData, stats.total)} hint={t("noDataHint")} />
        <Tile label={t("satisfaction")} value={percent(stats.feedback.up, rated)} hint={t("ratings", { count: rated })} />
        <Tile label={t("latency")} value={`${(stats.avgLatencyMs / 1000).toFixed(1)} s`} />
        <Tile label={t("errors")} value={percent(stats.errors, stats.total)} />
        <Tile label={t("authenticated")} value={percent(stats.authenticated, stats.total)} />
        <Tile label={t("users")} value={stats.users} />
        <Tile label={t("conversations")} value={stats.conversations} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-medium">{t("byMode")}</h2>
          <Bars
            rows={[
              { label: t("modeDocs"), value: stats.byMode.docs },
              { label: t("modeWeb"), value: stats.byMode.web },
            ]}
          />
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-medium">{t("byLocale")}</h2>
          <Bars
            rows={[
              { label: "Русский", value: stats.byLocale.ru },
              { label: "Қазақша", value: stats.byLocale.kk },
              { label: "English", value: stats.byLocale.en },
            ]}
          />
        </section>
      </div>

      <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-sm font-medium">{t("daily")}</h2>
        {stats.daily.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("empty")}</p>
        ) : (
          <Bars rows={stats.daily.slice(-14).map((d) => ({ label: d.day.slice(5), value: d.count }))} />
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-sm font-medium">{t("documents")}</h2>
        <ul className="divide-y divide-white/5 text-sm">
          {stats.documents.map((d) => (
            <li key={d.title} className="flex items-center justify-between gap-4 py-2">
              <span className="text-zinc-300">{d.title}</span>
              <span className="shrink-0 tabular-nums text-zinc-500">{t("chunks", { count: d.chunkCount })}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
