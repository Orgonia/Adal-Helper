"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, FileText, ImagePlus, Mic, Paperclip, Square, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  classifyFile,
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
  MAX_FILES,
  MAX_MESSAGE_CHARS,
  MAX_TOTAL_BYTES,
} from "@/lib/chat-config";
import { uid } from "@/lib/id";
import { compressImage } from "@/lib/image";
import { useDictation } from "@/lib/speech";
import { cn } from "@/lib/utils";
import type { PendingAttachment } from "@/types/chat";

interface ChatInputProps {
  busy: boolean;
  onSend: (text: string, attachments: PendingAttachment[]) => void;
  onStop: () => void;
}

function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-9 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "animate-pulse bg-red-500/20 text-red-300"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}

export function ChatInput({ busy, onSend, onStop }: ChatInputProps) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Голосовой ввод: распознанный текст дописывается к уже набранному
  const dictationBaseRef = useRef("");
  const dictation = useDictation(locale, (chunk, final) => {
    const base = dictationBaseRef.current.trimEnd();
    const joined = `${base ? `${base} ` : ""}${chunk.trim()}`.slice(0, MAX_MESSAGE_CHARS);
    if (final) dictationBaseRef.current = joined;
    setText(joined);
  }, (error) => setNotice(t(error === "denied" ? "errors.micDenied" : "errors.micFailed")));

  function toggleDictation() {
    if (dictation.listening) {
      dictation.stop();
    } else {
      dictationBaseRef.current = text;
      dictation.start();
    }
  }

  // Автоувеличение поля ввода (до 200 px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  // Подсказка об ошибке исчезает сама
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(id);
  }, [notice]);

  const addFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return;
      setProcessing(true);
      try {
        const list = [...attachments];

        for (const original of incoming) {
          if (list.length >= MAX_FILES) {
            setNotice(t("errors.tooMany", { max: MAX_FILES }));
            break;
          }
          const kind = classifyFile(original);
          if (!kind) {
            setNotice(t("errors.unsupported"));
            continue;
          }
          const file = kind === "image" ? await compressImage(original) : original;
          const total = list.reduce((sum, a) => sum + a.file.size, 0) + file.size;
          if (total > MAX_TOTAL_BYTES) {
            setNotice(t("errors.tooLarge", { max: MAX_TOTAL_BYTES / 1024 / 1024 }));
            continue;
          }
          list.push({
            id: uid(),
            file,
            kind,
            previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
          });
        }

        setAttachments(list);
      } finally {
        setProcessing(false);
      }
    },
    [attachments, t],
  );

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void addFiles(files);
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
    }
  }

  function remove(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  const canSend = !busy && !processing && (text.trim().length > 0 || attachments.length > 0);

  function submit() {
    if (!canSend) return;
    if (dictation.listening) dictation.stop();
    onSend(text, attachments);
    setText("");
    setAttachments([]);
    setNotice(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    // На телефонах Enter ставит перенос строки, отправка кнопкой
    if (window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    submit();
  }

  const attachDisabled = busy || processing || attachments.length >= MAX_FILES;

  return (
    <div>
      <AnimatePresence>
        {notice && (
          <motion.p
            key="notice"
            role="alert"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="rounded-3xl border border-white/10 bg-zinc-900/80 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur transition-colors focus-within:border-sky-400/40">
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((a) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
              >
                {a.kind === "image" && a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.previewUrl}
                    alt={a.file.name}
                    className="size-14 rounded-xl border border-white/10 object-cover"
                  />
                ) : (
                  <span className="flex h-14 max-w-48 items-center gap-2 rounded-xl border border-white/10 bg-zinc-800/60 px-3 text-xs text-zinc-300">
                    <FileText className="size-4 shrink-0 text-sky-400" />
                    <span className="truncate">{a.file.name}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  aria-label={t("removeAttachment")}
                  title={t("removeAttachment")}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-zinc-700 text-zinc-100 shadow transition hover:bg-zinc-600"
                >
                  <X className="size-3" />
                </button>
              </motion.li>
            ))}
          </ul>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="block max-h-[200px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-base leading-6 text-zinc-50 outline-none placeholder:text-zinc-500"
        />

        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-0.5">
            <IconButton
              label={t("attachFile")}
              disabled={attachDisabled}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-5" />
            </IconButton>
            <IconButton
              label={t("uploadPhoto")}
              disabled={attachDisabled}
              onClick={() => photoInputRef.current?.click()}
            >
              <ImagePlus className="size-5" />
            </IconButton>
            {dictation.supported && (
              <IconButton
                label={dictation.listening ? t("stopDictation") : t("dictate")}
                disabled={busy}
                active={dictation.listening}
                onClick={toggleDictation}
              >
                <Mic className="size-5" />
              </IconButton>
            )}
          </div>

          {busy ? (
            <button
              type="button"
              onClick={onStop}
              title={t("stop")}
              aria-label={t("stop")}
              className="grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-950 transition hover:bg-white"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              title={t("send")}
              aria-label={t("send")}
              className={cn(
                "grid size-9 place-items-center rounded-full transition",
                canSend
                  ? "bg-sky-400 text-zinc-950 hover:bg-sky-300"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-500",
              )}
            >
              <ArrowUp className="size-5" />
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept={DOCUMENT_ACCEPT}
        onChange={handlePick}
      />
      <input
        ref={photoInputRef}
        type="file"
        hidden
        multiple
        accept={IMAGE_ACCEPT}
        onChange={handlePick}
      />
    </div>
  );
}
