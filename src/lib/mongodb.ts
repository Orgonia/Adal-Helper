import { MongoClient, type Collection, type Db } from "mongodb";
import { COLLECTIONS } from "@/lib/config";
import type { ChunkDoc, SourceDoc } from "@/types";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Переменная окружения MONGODB_URI не задана");
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });

  return client.connect().catch((err) => {
    // Не кэшируем неудачное подключение, чтобы следующий запрос попробовал снова
    globalThis._mongoClientPromise = undefined;
    throw err;
  });
}

/** Singleton-подключение: переиспользуется между вызовами и при HMR в dev. */
export function getClientPromise(): Promise<MongoClient> {
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = createClientPromise();
  }
  return globalThis._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB ?? "adal_qogam");
}

export async function getChunksCollection(): Promise<Collection<ChunkDoc>> {
  return (await getDb()).collection<ChunkDoc>(COLLECTIONS.chunks);
}

export async function getSourcesCollection(): Promise<Collection<SourceDoc>> {
  return (await getDb()).collection<SourceDoc>(COLLECTIONS.sources);
}
