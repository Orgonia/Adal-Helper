"use client";

import { motion } from "framer-motion";
import { BookOpen, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/types/chat";

const OPTIONS = [
  { value: "docs", icon: BookOpen },
  { value: "web", icon: Globe },
] as const satisfies readonly { value: ChatMode; icon: typeof Globe }[];

interface ModeSwitcherProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export function ModeSwitcher({ mode, onChange, disabled }: ModeSwitcherProps) {
  const t = useTranslations("chat.modes");
  const id = useId();

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={cn(
        "relative inline-flex rounded-full border border-white/10 bg-zinc-900/80 p-1",
        disabled && "opacity-60",
      )}
    >
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              active
                ? value === "web"
                  ? "text-amber-950"
                  : "text-zinc-950"
                : "text-zinc-400 hover:text-zinc-200",
              disabled && "cursor-not-allowed",
            )}
          >
            {active && (
              <motion.span
                layoutId={`mode-pill-${id}`}
                className={cn(
                  "absolute inset-0 -z-10 rounded-full",
                  value === "web" ? "bg-amber-300" : "bg-sky-400",
                )}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="size-4" />
            {t(value)}
          </button>
        );
      })}
    </div>
  );
}
