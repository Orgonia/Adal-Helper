import "./env";
import { COLLECTIONS, EMBEDDING_DIMS, VECTOR_INDEX_NAME } from "@/lib/config";
import { getChunksCollection, getClientPromise, getDb } from "@/lib/mongodb";

async function main() {
  const db = await getDb();

  // Коллекция должна существовать до создания search-индекса
  const existing = await db.listCollections({ name: COLLECTIONS.chunks }).toArray();
  if (existing.length === 0) await db.createCollection(COLLECTIONS.chunks);

  const chunks = await getChunksCollection();
  await chunks.createIndex({ source: 1, chunkIndex: 1 });

  // Пользователи: один аккаунт на e-mail (регистрация по почте)
  await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });
  // История диалогов: список последних диалогов пользователя
  await db.collection("conversations").createIndex({ userId: 1, updatedAt: -1 });
  // Аналитика и оценки: старые записи удаляются автоматически через 180 дней
  await db.collection("analytics").createIndex({ at: 1 }, { expireAfterSeconds: 180 * 86_400 });
  await db.collection("feedback").createIndex({ at: 1 }, { expireAfterSeconds: 180 * 86_400 });
  console.log("Обычные индексы готовы ✅");

  const indexes = await chunks.listSearchIndexes(VECTOR_INDEX_NAME).toArray();

  if (indexes.length === 0) {
    await chunks.createSearchIndex({
      name: VECTOR_INDEX_NAME,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: EMBEDDING_DIMS,
            similarity: "cosine",
          },
          { type: "filter", path: "topic" },
          { type: "filter", path: "lang" },
        ],
      },
    });
    console.log(`Индекс "${VECTOR_INDEX_NAME}" создаётся...`);
  } else {
    console.log(`Индекс "${VECTOR_INDEX_NAME}" уже существует.`);
  }

  // Ждём, пока индекс станет доступен для запросов (до ~2 минут)
  for (let i = 0; i < 24; i++) {
    // В типах драйвера нет поля queryable, хотя Atlas его возвращает
    const [idx] = (await chunks.listSearchIndexes(VECTOR_INDEX_NAME).toArray()) as { queryable?: boolean }[];
    if (idx?.queryable) {
      console.log("Индекс готов к запросам ✅");
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log("Индекс ещё строится. Проверь статус в Atlas → Search & Vector Search.");
}

main()
  .catch((err) => {
    console.error("Ошибка:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = await getClientPromise().catch(() => null);
    await client?.close();
  });
