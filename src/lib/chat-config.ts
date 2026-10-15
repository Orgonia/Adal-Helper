import type { AttachmentKind } from "@/types/chat";

export const MAX_FILES = 3;
/** Лимит тела запроса на Vercel (serverless) около 4,5 МБ, оставляем запас. */
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY_MESSAGES = 10;
export const IMAGE_MAX_SIDE = 1600;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const DOCUMENT_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];

export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const DOCUMENT_ACCEPT = [...DOCUMENT_EXTENSIONS, ...DOCUMENT_TYPES].join(",");

export function classifyFile(file: File): AttachmentKind | null {
  const name = file.name.toLowerCase();
  if (IMAGE_TYPES.includes(file.type) || IMAGE_EXTENSIONS.some((e) => name.endsWith(e))) {
    return "image";
  }
  if (DOCUMENT_TYPES.includes(file.type) || DOCUMENT_EXTENSIONS.some((e) => name.endsWith(e))) {
    return "document";
  }
  return null;
}
