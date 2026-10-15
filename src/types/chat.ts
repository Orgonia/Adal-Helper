/** doc: ответ только по базе документов; web: дополнительно поиск в интернете */
export type ChatMode = "docs" | "web";

export interface SourceRef {
  kind?: "doc" | "web";
  title: string;
  heading?: string;
  /** Идентификатор источника: имя файла или URL */
  source: string;
  url?: string;
}

export type AttachmentKind = "image" | "document";

export interface PendingAttachment {
  id: string;
  file: File;
  kind: AttachmentKind;
  previewUrl?: string;
}

export type MessageStatus = "streaming" | "done" | "error";

/** Вложение из сохранённого диалога: сам файл не хранится, только имя. */
export interface SavedAttachment {
  name: string;
  kind: AttachmentKind;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  attachments?: PendingAttachment[];
  savedAttachments?: SavedAttachment[];
  status?: MessageStatus;
  /** Режим, в котором был получен ответ */
  mode?: ChatMode;
  error?: string;
}

/** События потока ответа (NDJSON: одна JSON-строка на событие). */
export type StreamEvent =
  | { type: "sources"; sources: SourceRef[] }
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
}

export type FeedbackRating = "up" | "down";
