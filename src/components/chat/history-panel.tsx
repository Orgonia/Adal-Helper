"use client";

import { History, LogIn, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { fetchConversations, removeConversation } from "@/lib/conversations-client";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types/chat";

interface HistoryPanelProps {
  signedIn: boolean;
  activeId: string;
  /** Меняется после каждого сохранения, чтобы обновить список */
  refreshKey: number;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
}

export function HistoryPanel({ signedIn, activeId, refreshKey, onOpen, onNew, onDeleted }: HistoryPanelProps) {
  const t = useTranslations("history");
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetchConversations()
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [signedIn, refreshKey]);

  async function remove(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await removeConversation(id);
      setItems((prev) => prev?.filter((c) => c.id !== id) ?? null);
      onDeleted(id);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <button
        type="button"
        onClick={onNew}
        className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:border-sky-400/40 hover:bg-white/5"
      >
        <Plus className="size-4" />
        {t("newChat")}
      </button>

      <p className="mx-4 mb-1 mt-5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <History className="size-3.5" />
        {t("title")}
      </p>

      {!signedIn ? (
        <div className="mx-3 mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
          <p>{t("guest")}</p>
          <Link
            href="/login"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-sky-400"
          >
            <LogIn className="size-3.5" />
            {t("signIn")}
          </Link>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {failed && <li className="px-2 py-1 text-xs text-red-300">{t("error")}</li>}
          {items === null && !failed &&
            [0, 1, 2].map((i) => <li key={i} className="mx-2 my-2 h-4 animate-pulse rounded bg-zinc-800" />)}
          {items?.length === 0 && <li className="px-2 py-1 text-sm text-zinc-500">{t("empty")}</li>}
          {items?.map((c) => (
            <li key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg py-2 pl-2 pr-8 text-left text-sm transition",
                  c.id === activeId ? "bg-white/10 text-zinc-50" : "text-zinc-300 hover:bg-white/5",
                )}
              >
                <MessageSquare className="size-3.5 shrink-0 text-zinc-500" />
                <span className="truncate">{c.title}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label={t("delete")}
                title={t("delete")}
                className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-zinc-500 opacity-100 transition hover:bg-red-500/15 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
