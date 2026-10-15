import type { ChatMessage, Conversation, ConversationSummary } from "@/types/chat";

const MAX_SAVED_MESSAGES = 100;

/** Убираем файлы (File нельзя сериализовать) и незавершённые ответы. */
function toSavable(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.status !== "streaming")
    .slice(-MAX_SAVED_MESSAGES)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      mode: m.mode,
      status: m.status === "error" ? ("error" as const) : ("done" as const),
      error: m.error,
      sources: m.sources,
      savedAttachments:
        m.attachments?.map((a) => ({ name: a.file.name.slice(0, 200), kind: a.kind })) ??
        m.savedAttachments,
    }));
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await fetch("/api/conversations", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).conversations;
}

export async function fetchConversation(id: string): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).conversation;
}

export async function saveConversation(id: string, messages: ChatMessage[]): Promise<void> {
  const savable = toSavable(messages);
  if (savable.length === 0) return;
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: savable }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function removeConversation(id: string): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
}
