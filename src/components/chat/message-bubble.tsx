"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  Copy,
  FileText,
  Globe,
  ImageIcon,
  RotateCcw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SourceList } from "@/components/chat/source-list";
import { ThinkingSkeleton } from "@/components/chat/thinking-skeleton";
import { useSpeaker } from "@/lib/speech";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatMode, FeedbackRating } from "@/types/chat";

const mdComponents: Components = {
  p: ({ children }) => <p className="my-3 leading-7 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-sky-400/70">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6 marker:text-sky-400/70">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-50">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:decoration-sky-400"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold text-zinc-50 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold text-zinc-50 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-2 mt-4 text-base font-semibold text-zinc-50 first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-4 text-base font-medium text-zinc-100 first:mt-0">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-amber-300/50 pl-4 text-zinc-300">{children}</blockquote>
  ),
  hr: () => <hr className="my-5 border-white/10" />,
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-zinc-900 p-3 text-sm [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  code: ({ className, children }) => (
    <code className={cn("rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em]", className)}>
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-white/10 bg-white/5 px-3 py-2 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-white/5 px-3 py-2 align-top">{children}</td>,
};

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* буфер обмена недоступен */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
    >
      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

const actionClass =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200";

function SpeakButton({ text }: { text: string }) {
  const t = useTranslations("chat");
  const speaker = useSpeaker(useLocale());
  if (!speaker.supported) return null;
  return (
    <button type="button" onClick={() => speaker.toggle(text)} className={actionClass}>
      {speaker.speaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
      {speaker.speaking ? t("stopSpeaking") : t("speak")}
    </button>
  );
}

function FeedbackButtons({ messageId, mode }: { messageId: string; mode?: ChatMode }) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [rating, setRating] = useState<FeedbackRating | null>(null);

  async function rate(value: FeedbackRating) {
    const previous = rating;
    setRating(value);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating: value, mode, locale }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setRating(previous);
    }
  }

  return (
    <>
      {(["up", "down"] as const).map((value) => {
        const Icon = value === "up" ? ThumbsUp : ThumbsDown;
        const active = rating === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => rate(value)}
            aria-pressed={active}
            aria-label={t(value === "up" ? "feedbackUp" : "feedbackDown")}
            title={t(value === "up" ? "feedbackUp" : "feedbackDown")}
            className={cn(actionClass, active && (value === "up" ? "text-emerald-400" : "text-red-400"))}
          >
            <Icon className={cn("size-3.5", active && "fill-current")} />
          </button>
        );
      })}
      {rating && <span className="px-1 text-xs text-zinc-500">{t("feedbackThanks")}</span>}
    </>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry: (assistantId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const t = useTranslations("chat");
  const { role, content, status, error, sources, attachments, savedAttachments, mode } = message;

  if (role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] space-y-2">
          {!attachments?.length && savedAttachments && savedAttachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {savedAttachments.map((a, i) => (
                <span
                  key={`${a.name}-${i}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-400"
                >
                  {a.kind === "image" ? (
                    <ImageIcon className="size-4 shrink-0 text-sky-400" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-sky-400" />
                  )}
                  <span className="truncate">{a.name}</span>
                </span>
              ))}
            </div>
          )}
          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {attachments.map((a) =>
                a.kind === "image" && a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={a.id}
                    src={a.previewUrl}
                    alt={a.file.name}
                    className="size-20 rounded-xl border border-white/10 object-cover"
                  />
                ) : (
                  <span
                    key={a.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300"
                  >
                    <FileText className="size-4 shrink-0 text-sky-400" />
                    <span className="truncate">{a.file.name}</span>
                  </span>
                ),
              )}
            </div>
          )}
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-zinc-800 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-50">
            {content}
          </div>
        </div>
      </motion.div>
    );
  }

  const streaming = status === "streaming";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-3"
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-amber-300 text-zinc-950">
        <Scale className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            mode === "web"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
              : "border-white/10 bg-white/5 text-zinc-400",
          )}
        >
          {mode === "web" ? <Globe className="size-3" /> : <BookOpen className="size-3" />}
          {t(mode === "web" ? "modes.web" : "modes.docs")}
        </span>

        {streaming && !content && <ThinkingSkeleton />}

        {content && (
          <div className="break-words text-[15px] text-zinc-100">
            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {content}
            </Markdown>
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-sky-400 align-middle" />
            )}
          </div>
        )}

        {!streaming && !content && !error && (
          <p className="text-sm text-zinc-500">{t("stopped")}</p>
        )}

        {status === "error" && error && (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
            >
              <RotateCcw className="size-3.5" />
              {t("retry")}
            </button>
          </div>
        )}

        {sources && sources.length > 0 && content && <SourceList sources={sources} />}

        {status === "done" && content && (
          <div className="mt-2 -ml-2 flex flex-wrap items-center gap-0.5">
            <CopyButton text={content} />
            <SpeakButton text={content} />
            <FeedbackButtons messageId={message.id} mode={mode} />
          </div>
        )}
      </div>
    </motion.div>
  );
});
