import { BookOpen, BrainCircuit, ExternalLink, FileSearch, Globe, Lock, MessageSquareText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DOCUMENTS } from "@/lib/documents";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("metaTitle") };
}

const STEPS = [
  { key: "step1", icon: MessageSquareText },
  { key: "step2", icon: FileSearch },
  { key: "step3", icon: BrainCircuit },
  { key: "step4", icon: ShieldCheck },
] as const;

const CONCEPTS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="bg-gradient-to-r from-sky-300 via-zinc-50 to-amber-200 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
        {t("title")}
      </h1>
      <p className="mt-3 leading-relaxed text-zinc-400">{t("intro")}</p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t("howTitle")}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {STEPS.map(({ key, icon: Icon }, i) => (
            <li key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <span className="grid size-7 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
                  <Icon className="size-4" />
                </span>
                {i + 1}. {t(`${key}Title`)}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t(`${key}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-4">
          <p className="flex items-center gap-2 font-medium text-sky-200">
            <BookOpen className="size-4" />
            {t("docsModeTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("docsModeText")}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
          <p className="flex items-center gap-2 font-medium text-amber-200">
            <Globe className="size-4" />
            {t("webModeTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("webModeText")}</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t("baseTitle")}</h2>
        <p className="mt-2 text-sm text-zinc-400">{t("baseText")}</p>
        <ul className="mt-4 space-y-2">
          {DOCUMENTS.map((d) => (
            <li key={d.file}>
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200 transition hover:border-sky-400/40"
                >
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-sky-400" />
                  <span className="flex-1">{d.title}</span>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                </a>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-sky-400" />
                  {d.title}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t("conceptsTitle")}</h2>
        <p className="mt-2 text-sm text-zinc-400">{t("conceptsText")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CONCEPTS.map((c) => (
            <span key={c} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-sm text-zinc-300">
              {t(`concepts.${c}`)}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="flex items-center gap-2 font-medium">
          <Lock className="size-4 text-emerald-400" />
          {t("privacyTitle")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("privacyText")}</p>
      </section>

      <div className="mt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400"
        >
          <MessageSquareText className="size-4" />
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}
