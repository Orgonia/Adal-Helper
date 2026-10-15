import "./env";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { TOPICS } from "@/lib/config";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/gemini";
import {
  getChunksCollection,
  getClientPromise,
  getSourcesCollection,
} from "@/lib/mongodb";
import type { ChunkDoc } from "@/types";

const DOCS_DIR = path.join(process.cwd(), "data", "documents");
const SUPPORTED = new Set([".txt", ".md", ".pdf", ".docx"]);
const FORCE = process.argv.includes("--force");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface Meta {
  title?: string;
  topic?: string;
  lang?: string;
  url?: string;
}

async function loadManifest(): Promise<Record<string, Meta>> {
  const file = path.join(DOCS_DIR, "manifest.json");
  if (!existsSync(file)) return {};
  return JSON.parse(await readFile(file, "utf8"));
}

async function saveManifest(manifest: Record<string, Meta>) {
  const file = path.join(DOCS_DIR, "manifest.json");
  await writeFile(file, JSON.stringify(manifest, null, 2), "utf8");
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const modPath = "pdf-parse/lib/pdf-parse.js";
  const mod = await import(modPath);
  const pdfParse = mod.default ?? mod;
  const data = await pdfParse(buffer);
  return data.text as string;
}

async function extractText(file: string, buffer: Buffer): Promise<string> {
  switch (path.extname(file).toLowerCase()) {
    case ".pdf":
      return parsePdf(buffer);
    case ".docx":
      return (await mammoth.extractRawText({ buffer })).value;
    default:
      return buffer.toString("utf8");
  }
}

async function autoDetectMetadata(textSample: string, fileName: string): Promise<{ title: string; topic: string; slug: string }> {
  try {
    const modelName = process.env.GEMINI_CHAT_MODEL ?? "gemini-3.8-flash";
    const model = genAI.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(
      `Analyze this legal document text from Kazakhstan. Return a strict JSON object with 3 fields without markdown ticks:
      1. "title": The official full title of the law/document in Russian.
      2. "topic": A category slug from this list [${TOPICS.join(", ")}], choose the most appropriate one.
      3. "slug": A short, clean filename slug in English without extension (e.g., "law-tax-code").

      Text sample:
      ${textSample.slice(0, 3000)}

      Output ONLY valid JSON:`
    );
    
    const raw = response.response.text()?.trim() || "";
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(clean);
    return {
      title: parsed.title || fileName,
      topic: TOPICS.includes(parsed.topic) ? parsed.topic : "constitution",
      slug: parsed.slug || fileName.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "-"),
    };
  } catch {
    return {
      title: fileName.replace(/\.[^/.]+$/, ""),
      topic: "constitution",
      slug: fileName.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "-"),
    };
  }
}

async function main() {
  if (!existsSync(DOCS_DIR)) {
    throw new Error(`Папка не найдена: ${DOCS_DIR}`);
  }

  const manifest = await loadManifest();
  let files = (await readdir(DOCS_DIR)).filter((f) =>
    SUPPORTED.has(path.extname(f).toLowerCase()),
  );

  if (files.length === 0) {
    console.log("В data/documents нет файлов.");
    return;
  }

  const sources = await getSourcesCollection();
  const chunksCol = await getChunksCollection();

  for (let file of files) {
    const filePath = path.join(DOCS_DIR, file);
    const buffer = await readFile(filePath);
    const text = await extractText(file, buffer);

    if (!text || text.length < 50) {
      console.warn(`⚠ ${file}: текст не извлечён, пропускаю`);
      continue;
    }

    let meta = manifest[file];

    if (!meta) {
      console.log(`🤖 Анализирую новый файл через AI: ${file}`);
      const detected = await autoDetectMetadata(text, file);
      const ext = path.extname(file);
      const newFileName = `${detected.slug}${ext}`;
      const newFilePath = path.join(DOCS_DIR, newFileName);

      if (file !== newFileName && !existsSync(newFilePath)) {
        await rename(filePath, newFilePath);
        console.log(`✎ Переименовано: ${file} -> ${newFileName}`);
        file = newFileName;
      }

      meta = {
        title: detected.title,
        topic: detected.topic,
        lang: "ru",
        url: `[https://adilet.zan.kz/rus/docs/](https://adilet.zan.kz/rus/docs/)`,
      };

      manifest[file] = meta;
      await saveManifest(manifest);
    }

    const title = meta.title ?? path.parse(file).name;
    const topic = meta.topic ?? "constitution";
    const lang = meta.lang ?? "ru";

    const hash = createHash("sha256")
      .update(buffer)
      .update(JSON.stringify({ title, topic, lang }))
      .digest("hex");

    const prev = await sources.findOne({ _id: file });
    if (prev?.hash === hash && !FORCE) {
      console.log(`↷ ${file}: без изменений, пропускаю`);
      continue;
    }

    console.log(`→ Обработка и векторизация: ${file} (${title})`);
    const pieces = chunkText(text);
    if (pieces.length === 0) continue;

    const inputs = pieces.map((c) =>
      [title, c.heading, c.text].filter(Boolean).join("\n"),
    );
    const vectors = await embedTexts(inputs, "RETRIEVAL_DOCUMENT");

    const now = new Date();
    const docs: ChunkDoc[] = pieces.map((c, i) => ({
      source: file,
      title,
      topic,
      lang,
      heading: c.heading,
      chunkIndex: i,
      text: c.text,
      embedding: vectors[i],
      createdAt: now,
    }));

    await chunksCol.deleteMany({ source: file });
    await chunksCol.insertMany(docs);
    await sources.updateOne(
      { _id: file },
      { $set: { title, topic, lang, hash, chunkCount: docs.length, updatedAt: now } },
      { upsert: true },
    );
    console.log(`✓ ${file}: записано ${docs.length} фрагментов`);
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