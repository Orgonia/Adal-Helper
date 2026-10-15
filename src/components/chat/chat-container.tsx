"use client";

import { MotionConfig } from "framer-motion";
import { PanelLeft, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";
import { HistoryPanel } from "@/components/chat/history-panel";
import { MessageList } from "@/components/chat/message-list";
import { ModeSwitcher } from "@/components/chat/mode-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ChatApiError, streamChat } from "@/lib/chat-client";
import { fetchConversation, saveConversation } from "@/lib/conversations-client";
import { uid } from "@/lib/id";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatMode, PendingAttachment } from "@/types/chat";

export function ChatContainer({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("chat");
  const locale = useLocale();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  // По умолчанию всегда безопасный режим: только по документам
  const [mode, setMode] = useState<ChatMode>("docs");
  const [conversationId, setConversationId] = useState(uid);
  const [historyKey, setHistoryKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  /** Есть несохранённые изменения (новый ответ завершился) */
  const dirtyRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Прерываем запрос при уходе со страницы
  useEffect(() => () => abortRef.current?.abort(), []);

  // Автопрокрутка вниз, пока пользователь сам не прокрутил вверх
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: busy ? "auto" : "smooth" });
    }
  }, [messages, busy]);

  // Сохраняем диалог в MongoDB, когда ответ завершён (только для вошедших)
  useEffect(() => {
    if (!signedIn || busy || !dirtyRef.current || messages.length === 0) return;
    dirtyRef.current = false;
    saveConversation(conversationId, messages)
      .then(() => setHistoryKey((k) => k + 1))
      .catch((error) => console.warn("[history] Не удалось сохранить диалог:", error));
  }, [signedIn, busy, messages, conversationId]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const errorText = useCallback(
    (err: unknown): string => {
      if (err instanceof ChatApiError) {
        if (err.status === 429) return t("errors.rateLimit");
        return t("errors.server");
      }
      return t("errors.network");
    },
    [t],
  );

  const generate = useCallback(
    async (history: ChatMessage[], assistantId: string, files: File[], requestMode: ChatMode) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      try {
        for await (const event of streamChat({
          messages: history,
          files,
          locale,
          mode: requestMode,
          signal: controller.signal,
        })) {
          if (event.type === "sources") {
            patch(assistantId, (m) => ({ ...m, sources: event.sources }));
          } else if (event.type === "delta") {
            patch(assistantId, (m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === "error") {
            patch(assistantId, (m) => ({
              ...m,
              status: "error",
              error: event.message || t("errors.server"),
            }));
            return;
          }
        }
        patch(assistantId, (m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
      } catch (err) {
        if (controller.signal.aborted) {
          patch(assistantId, (m) => ({ ...m, status: "done" }));
          return;
        }
        patch(assistantId, (m) => ({ ...m, status: "error", error: errorText(err) }));
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          dirtyRef.current = true;
          setBusy(false);
        }
      }
    },
    [locale, patch, t, errorText],
  );

  const send = useCallback(
    (text: string, attachments: PendingAttachment[]) => {
      if (busy) return;

      const userMessage: ChatMessage = {
        id: uid(),
        role: "user",
        content: text.trim() || t("defaultFilePrompt"),
        attachments: attachments.length > 0 ? attachments : undefined,
        status: "done",
      };
      const assistantMessage: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        status: "streaming",
        mode,
      };

      const history = [...messagesRef.current, userMessage];
      setMessages([...history, assistantMessage]);
      stickRef.current = true;
      void generate(history, assistantMessage.id, attachments.map((a) => a.file), mode);
    },
    [busy, generate, t, mode],
  );

  const retry = useCallback(
    (assistantId: string) => {
      if (busy) return;
      const all = messagesRef.current;
      const index = all.findIndex((m) => m.id === assistantId);
      if (index < 1) return;

      const history = all.slice(0, index);
      const lastUser = history[history.length - 1];
      if (lastUser?.role !== "user") return;

      patch(assistantId, (m) => ({
        ...m,
        content: "",
        sources: undefined,
        error: undefined,
        status: "streaming",
      }));
      stickRef.current = true;
      void generate(
        history,
        assistantId,
        (lastUser.attachments ?? []).map((a) => a.file),
        all[index].mode ?? "docs",
      );
    },
    [busy, generate, patch],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  function reset(nextId: string, nextMessages: ChatMessage[]) {
    abortRef.current?.abort();
    abortRef.current = null;
    dirtyRef.current = false;
    setBusy(false);
    setConversationId(nextId);
    setMessages(nextMessages);
    stickRef.current = true;
    setHistoryOpen(false);
  }

  function newChat() {
    reset(uid(), []);
  }

  async function openConversation(id: string) {
    if (id === conversationId) {
      setHistoryOpen(false);
      return;
    }
    try {
      const conversation = await fetchConversation(id);
      const restored: ChatMessage[] = conversation.messages.map((m) => ({
        ...m,
        status: m.status === "error" ? "error" : "done",
      }));
      reset(conversation.id, restored);
    } catch {
      // Диалог мог быть удалён в другой вкладке: обновим список
      setHistoryKey((k) => k + 1);
    }
  }

  function handleDeleted(id: string) {
    if (id === conversationId) newChat();
  }

  const history = (
    <HistoryPanel
      signedIn={signedIn}
      activeId={conversationId}
      refreshKey={historyKey}
      onOpen={openConversation}
      onNew={newChat}
      onDeleted={handleDeleted}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full min-h-0">
        {/* История диалогов: на компьютере постоянная панель, на телефоне выезжает слева */}
        <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-zinc-950/40 lg:block">{history}</aside>
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="left" className="w-72 border-white/10 bg-zinc-950 p-0 text-zinc-100">
            <SheetTitle className="sr-only">{t("history")}</SheetTitle>
            <div className="h-full pt-8">{history}</div>
          </SheetContent>
        </Sheet>

        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <div className="px-4 pt-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHistoryOpen(true)}
                  aria-label={t("history")}
                  title={t("history")}
                  className="text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
                >
                  <PanelLeft className="size-5" />
                </Button>
                <ModeSwitcher mode={mode} onChange={setMode} disabled={busy} />
              </div>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={newChat}
                  aria-label={t("newChat")}
                  className="gap-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">{t("newChat")}</span>
                </Button>
              )}
            </div>
            <p
              className={cn(
                "mt-2 text-xs leading-snug",
                mode === "web" ? "text-amber-300/90" : "text-zinc-500",
              )}
            >
              {t(mode === "web" ? "modes.webHint" : "modes.docsHint")}
            </p>
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4"
          >
            {messages.length === 0 ? (
              <EmptyState onPick={(question) => send(question, [])} />
            ) : (
              <MessageList messages={messages} onRetry={retry} />
            )}
          </div>

          <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
            <ChatInput busy={busy} onSend={send} onStop={stop} />
            <p className="mt-2 text-center text-[11px] leading-snug text-zinc-500">{t("disclaimer")}</p>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
