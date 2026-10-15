import { MIN_SCORE, TOP_K, VECTOR_INDEX_NAME } from "@/lib/config";
import { embedQuery } from "@/lib/gemini";
import { getChunksCollection } from "@/lib/mongodb";
import type { RetrievedChunk } from "@/types";

interface SearchOptions {
  limit?: number;
  topic?: string;
  minScore?: number;
}

export interface SearchResult {
  /** Все найденные фрагменты (для отладки) */
  all: RetrievedChunk[];
  /** Только фрагменты выше порога релевантности */
  relevant: RetrievedChunk[];
}

export async function searchChunks(
  query: string,
  { limit = TOP_K, topic, minScore = MIN_SCORE }: SearchOptions = {},
): Promise<SearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { all: [], relevant: [] };

  const queryVector = await embedQuery(trimmed);
  const chunks = await getChunksCollection();

  const all = await chunks
    .aggregate<RetrievedChunk>([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(limit * 25, 100),
          limit,
          ...(topic ? { filter: { topic } } : {}),
        },
      },
      {
        $project: {
          _id: 0,
          text: 1,
          title: 1,
          source: 1,
          topic: 1,
          heading: 1,
          chunkIndex: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();

  return { all, relevant: all.filter((c) => c.score >= minScore) };
}
