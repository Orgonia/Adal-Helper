export const COLLECTIONS = {
  chunks: "chunks",
  sources: "sources",
} as const;

/** Размерность эмбеддингов. Должна совпадать с индексом в Atlas. */
export const EMBEDDING_DIMS = 768;

export const VECTOR_INDEX_NAME = "chunks_vector_index";

/** Сколько фрагментов отдаём в контекст модели */
export const TOP_K = 6;

/**
 * Минимальная релевантность (0..1). В Atlas при cosine score = (1 + cos) / 2,
 * поэтому значения обычно высокие. Порог калибруется через `npm run search`.
 */
export const MIN_SCORE = Number(process.env.RAG_MIN_SCORE ?? 0.72);

export const TOPICS = [
  "constitution",
  "law-and-order",
  "adal-azamat",
  "taza-qazaqstan",
  "general",
] as const;

export type Topic = (typeof TOPICS)[number];
