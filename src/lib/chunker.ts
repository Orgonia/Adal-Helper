export interface TextChunk {
  text: string;
  heading: string;
}

interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

// Заголовки структуры нормативных текстов (RU / KK / EN)
const HEADING_RE =
  /^(статья|глава|раздел|пункт|бап|тарау|бөлім|article|chapter|section)\s+[\dIVXLCivxlc]+/i;

function splitLongParagraph(p: string, maxChars: number): string[] {
  const sentences = p.split(/(?<=[.!?…])\s+/);
  const parts: string[] = [];
  let buf = "";

  for (const s of sentences) {
    if (s.length > maxChars) {
      if (buf) parts.push(buf);
      buf = "";
      for (let i = 0; i < s.length; i += maxChars) {
        parts.push(s.slice(i, i + maxChars));
      }
      continue;
    }
    if (buf && buf.length + s.length + 1 > maxChars) {
      parts.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

function tail(text: string, overlap: number): string {
  if (overlap <= 0 || text.length <= overlap) return "";
  const slice = text.slice(-overlap);
  const firstSpace = slice.indexOf(" ");
  return firstSpace > 0 ? slice.slice(firstSpace + 1) : slice;
}

export function chunkText(
  raw: string,
  { maxChars = 1200, overlap = 150 }: ChunkOptions = {},
): TextChunk[] {
  const text = raw
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ");

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > maxChars ? splitLongParagraph(p, maxChars) : [p]));

  const chunks: TextChunk[] = [];
  let heading = "";
  let buf = "";
  let bufHeading = "";

  const flush = () => {
    const t = buf.trim();
    if (t.length > 0) chunks.push({ text: t, heading: bufHeading });
  };

  for (const p of paragraphs) {
    const isHeading = p.length < 200 && HEADING_RE.test(p);

    if (isHeading) {
      flush();
      heading = p;
      bufHeading = p;
      buf = p;
      continue;
    }

    if (buf && buf.length + p.length + 2 > maxChars) {
      const carry = tail(buf, overlap);
      flush();
      bufHeading = heading;
      buf = carry ? `${carry}\n\n${p}` : p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
      if (!bufHeading) bufHeading = heading;
    }
  }
  flush();

  // Отбрасываем слишком короткие обрывки (например, одинокий заголовок)
  return chunks.filter((c) => c.text.length >= 40);
}
