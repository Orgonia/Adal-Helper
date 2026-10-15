"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const LINES = ["w-[92%]", "w-[78%]", "w-[58%]"];

export function ThinkingSkeleton() {
  const t = useTranslations("chat");

  return (
    <div role="status" aria-live="polite" className="space-y-3 py-1">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <motion.span
          className="size-2 rounded-full bg-sky-400"
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {t("thinking")}
      </div>
      <div className="space-y-2.5">
        {LINES.map((width, i) => (
          <motion.div
            key={width}
            className={`h-3 rounded-full bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 ${width}`}
            animate={{ opacity: [0.35, 0.9, 0.35] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
          />
        ))}
      </div>
    </div>
  );
}
