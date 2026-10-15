"use client";

import { MessageBubble } from "@/components/chat/message-bubble";
import type { ChatMessage } from "@/types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  onRetry: (assistantId: string) => void;
}

export function MessageList({ messages, onRetry }: MessageListProps) {
  return (
    <div className="flex w-full flex-col gap-6 py-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} onRetry={onRetry} />
      ))}
    </div>
  );
}
