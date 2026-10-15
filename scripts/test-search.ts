import "./env";
import { searchChunks } from "@/lib/rag";
import { getClientPromise } from "@/lib/mongodb";

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.log('Использование: npm run search -- "ваш вопрос"');
    return;
  }

  const { all, relevant } = await searchChunks(query);
  console.log(`\nВопрос: ${query}`);
  console.log(`Найдено: ${all.length}, выше порога: ${relevant.length}\n`);

  for (const c of all) {
    const mark = relevant.includes(c) ? "✅" : "❌";
    console.log(`${mark} ${c.score.toFixed(3)} | ${c.title} | ${c.heading || "—"}`);
    console.log(`   ${c.text.slice(0, 140).replace(/\n/g, " ")}...\n`);
  }
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
