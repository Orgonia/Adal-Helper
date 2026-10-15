"use client";

import { BookOpen, ExternalLink, FileText, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { SourceRef } from "@/types/chat";

export function SourceList({ sources }: { sources: SourceRef[] }) {
  const t = useTranslations("chat");

  // Каждый документ или страница показывается один раз
  const keyOf = (s: SourceRef) => (s.kind === "web" ? (s.url ?? s.source) : s.source);
  const unique = sources.filter((s, i) => sources.findIndex((x) => keyOf(x) === keyOf(s)) === i);
  if (unique.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <BookOpen className="size-3.5" />
        {t("sources")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {unique.map((s) => {
          const isWeb = s.kind === "web";
          const href = s.url && /^https?:\/\//i.test(s.url) ? s.url : undefined;
          const body = (
            <>
              {isWeb ? (
                <Globe className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
              ) : (
                <FileText className="mt-0.5 size-3.5 shrink-0 text-sky-400" />
              )}
              <span className="flex-1">
                <span className="line-clamp-2">{s.title}</span>
                {!isWeb && (
                  <span className="mt-0.5 block text-[11px] text-zinc-500">
                    {t("officialSource")}
                    {s.heading ? ` · ${s.heading}` : ""}
                  </span>
                )}
              </span>
              {href && <ExternalLink className="mt-0.5 size-3 shrink-0 text-zinc-500" />}
            </>
          );
          const className = cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs text-zinc-300 transition",
            isWeb
              ? "border-amber-400/20 bg-amber-400/[0.04] hover:border-amber-400/40"
              : "border-white/10 bg-white/[0.03] hover:border-sky-400/40",
            href && "hover:text-zinc-100",
          );

          return (
            <li key={keyOf(s)}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                  {body}
                </a>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
