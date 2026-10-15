import type { Part } from "@google/genai";
import mammoth from "mammoth";
import { MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/chat-config";

export type AttachmentErrorCode = "too_many" | "too_large" | "unsupported" | "empty";

export class AttachmentError extends Error {
  constructor(readonly code: AttachmentErrorCode) {
    super(code);
    this.name = "AttachmentError";
  }
}

export interface ProcessedAttachments {
  /** Файлы, которые Gemini читает сам (фото и PDF) */
  parts: Part[];
  /** Текст, извлечённый из .docx / .txt / .md */
  texts: { name: string; text: string }[];
  count: number;
}

const MAX_TEXT_CHARS = 30_000;

/** Определяем тип по содержимому, а не по заявленному типу файла. */
function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heim", "heis"].includes(brand)) return "image/heif";
  }
  return null;
}

const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString("ascii") === "%PDF-";
const isZip = (buf: Buffer) => buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

function decodeText(buf: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    // Старые русские .txt часто в Windows-1251
    return new TextDecoder("windows-1251").decode(buf);
  }
}

/** Имя файла попадает в запрос к модели, поэтому убираем переводы строк и лишнее. */
function safeName(name: string): string {
  return name.replace(/[\r\n\t<>]+/g, " ").trim().slice(0, 80) || "file";
}

export async function processAttachments(files: File[]): Promise<ProcessedAttachments> {
  if (files.length > MAX_FILES) throw new AttachmentError("too_many");

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_BYTES + 256 * 1024) throw new AttachmentError("too_large");

  const result: ProcessedAttachments = { parts: [], texts: [], count: 0 };

  for (const file of files) {
    if (file.size === 0) throw new AttachmentError("empty");

    const buf = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    const imageMime = sniffImage(buf);
    if (imageMime) {
      result.parts.push({ inlineData: { mimeType: imageMime, data: buf.toString("base64") } });
    } else if (name.endsWith(".pdf") && isPdf(buf)) {
      result.parts.push({ inlineData: { mimeType: "application/pdf", data: buf.toString("base64") } });
    } else if (name.endsWith(".docx") && isZip(buf)) {
      let text: string;
      try {
        text = (await mammoth.extractRawText({ buffer: buf })).value;
      } catch {
        throw new AttachmentError("unsupported");
      }
      if (!text.trim()) throw new AttachmentError("empty");
      result.texts.push({ name: safeName(file.name), text: text.slice(0, MAX_TEXT_CHARS) });
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      if (buf.includes(0)) throw new AttachmentError("unsupported");
      const text = decodeText(buf);
      if (!text.trim()) throw new AttachmentError("empty");
      result.texts.push({ name: safeName(file.name), text: text.slice(0, MAX_TEXT_CHARS) });
    } else {
      throw new AttachmentError("unsupported");
    }

    result.count++;
  }

  return result;
}
