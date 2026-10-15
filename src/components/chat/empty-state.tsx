"use client";

import { motion } from "framer-motion";
import { Scale } from "lucide-react";
import { useTranslations } from "next-intl";

const SUGGESTIONS = ["suggestion1", "suggestion2", "suggestion3", "suggestion4"] as const;

export function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  const t = useTranslations("chat");

  return (
    <div className="my-auto flex flex-col items-center py-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-amber-300 text-zinc-950 shadow-lg shadow-sky-500/20"
      >
        <Scale className="size-7" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4 }}
        className="mt-6 bg-gradient-to-r from-sky-300 via-zinc-50 to-amber-200 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl"
      >
        {t("greetingTitle")}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.4 }}
        className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400 sm:text-base"
      >
        {t("greetingSubtitle")}
      </motion.p>

      <p className="mt-9 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {t("tryAsking")}
      </p>
      <div className="mt-3 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((key, i) => (
          <motion.button
            key={key}
            type="button"
            onClick={() => onPick(t(key))}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 + i * 0.07, duration: 0.35 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-zinc-200 transition-colors hover:border-sky-400/40 hover:bg-white/[0.06]"
          >
            {t(key)}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
