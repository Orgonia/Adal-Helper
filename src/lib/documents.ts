import manifest from "../../data/documents/manifest.json";

export interface DocumentMeta {
  file: string;
  title: string;
  topic: string;
  lang: string;
  /** Ссылка на официальный текст (adilet.zan.kz и т.п.) */
  url?: string;
}

const entries = manifest as Record<string, Omit<DocumentMeta, "file">>;

/** Документы базы знаний из data/documents/manifest.json. */
export const DOCUMENTS: DocumentMeta[] = Object.entries(entries).map(([file, meta]) => ({
  file,
  ...meta,
}));

/** Ссылку берём только из манифеста: модель не может подставить свою. */
export function officialUrl(file: string): string | undefined {
  const url = entries[file]?.url;
  return url && /^https:\/\//.test(url) ? url : undefined;
}
