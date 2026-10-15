import { MAX_HISTORY_MESSAGES } from "@/lib/chat-config";
import type { ChatMessage, ChatMode, StreamEvent } from "@/types/chat";

export class ChatApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ChatApiError";
  }
}

interface StreamChatParams {
  messages: ChatMessage[];
  files: File[];
  locale: string;
  mode: ChatMode;
  signal: AbortSignal;
}

function parseLine(line: string): StreamEvent | null {
  try {
    return JSON.parse(line) as StreamEvent;
  } catch {
    return null;
  }
}

/**
 * Отправляет историю и вложения на /api/chat и отдаёт события потока.
 * Протокол ответа: NDJSON, по одному JSON-событию в строке.
 */
export async function* streamChat({
  messages,
  files,
  locale,
  mode,
  signal,
}: StreamChatParams): AsyncGenerator<StreamEvent> {
  const history = messages
    .filter((m) => m.content.trim() && m.status !== "error")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  const form = new FormData();
  form.append("messages", JSON.stringify(history));
  form.append("locale", locale);
  form.append("mode", mode);
  for (const file of files) form.append("files", file, file.name);

  const res = await fetch("/api/chat", { method: "POST", body: form, signal });

  if (!res.ok || !res.body) {
    let message = "";
    try {
      message = (await res.json())?.error ?? "";
    } catch {
      /* тело не JSON */
    }
    throw new ChatApiError(message, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = parseLine(line);
      if (event) yield event;
    }
  }

  const rest = buffer.trim();
  if (rest) {
    const event = parseLine(rest);
    if (event) yield event;
  }
}
