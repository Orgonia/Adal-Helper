import { GoogleGenAI } from "@google/genai";
import { EMBEDDING_DIMS } from "@/lib/config";

let client: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Переменная окружения GEMINI_API_KEY не задана");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const BATCH_SIZE = 20;
const WINDOW_MS = 60_000;
/** Бесплатный тариф: 100 в минуту. Берём с запасом. */
const RATE_PER_MIN = Number(process.env.EMBED_RATE_PER_MIN ?? 80);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sent: { t: number; n: number }[] = [];

/** Ждёт, пока в скользящем окне в 60 секунд появится место для n запросов. */
async function throttle(n: number): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (sent.length && now - sent[0].t >= WINDOW_MS) sent.shift();
    const used = sent.reduce((s, x) => s + x.n, 0);
    if (used + n <= RATE_PER_MIN) {
      sent.push({ t: now, n });
      return;
    }
    const wait = WINDOW_MS - (now - sent[0].t) + 250;
    console.info(`⏳ Лимит Gemini, жду ${Math.ceil(wait / 1000)} с...`);
    await sleep(wait);
  }
}

/** При усечённой размерности вектор нужно нормализовать. */
function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function retryDelayMs(err: unknown, attempt: number): number {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retry in ([\d.]+)s/i);
  const suggested = m ? Math.ceil(parseFloat(m[1]) * 1000) + 2000 : 0;
  return Math.max(suggested, 5000 * (attempt + 1));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      const retryable = status === 429 || status === 500 || status === 503;
      if (!retryable || i === attempts - 1) break;
      const wait = retryDelayMs(err, i);
      console.info(`⏳ Gemini ${status}, повтор через ${Math.ceil(wait / 1000)} с...`);
      await sleep(wait);
    }
  }
  throw lastError;
}

export async function embedTexts(
  texts: string[],
  taskType: EmbedTask,
): Promise<number[][]> {
  const model = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
  const ai = getGenAI();
  const result: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const res = await withRetry(async () => {
      await throttle(batch.length);
      return ai.models.embedContent({
        model,
        contents: batch,
        config: { taskType, outputDimensionality: EMBEDDING_DIMS },
      });
    });

    const embeddings = res.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Gemini вернул ${embeddings.length} эмбеддингов вместо ${batch.length}`,
      );
    }
    for (const e of embeddings) {
      if (!e.values?.length) throw new Error("Пустой эмбеддинг от Gemini");
      result.push(normalize(e.values));
    }
  }

  return result;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text], "RETRIEVAL_QUERY");
  return vector;
}