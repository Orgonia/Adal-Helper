import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getChunksCollection } from "@/lib/mongodb";
import { chunkText } from "@/lib/chunker";
import pdfParse from "pdf-parse";

const ADMIN_EMAIL = "alemy112233@gmail.com";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token || token.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const formData = await req.formData();
    const title = formData.get("title") as string;
    const category = formData.get("category") as string || "Иное";
    const file = formData.get("file") as File | null;
    const rawText = formData.get("text") as string | null;

    let contentToProcess = "";

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await pdfParse(buffer);
      contentToProcess = parsed.text;
    } else if (rawText) {
      contentToProcess = rawText;
    }

    if (!title || !contentToProcess) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }

    const chunks = chunkText(contentToProcess);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const collection = await getChunksCollection();

    const docs: any[] = [];
    for (const chunk of chunks) {
      const emb = await embeddingModel.embedContent(chunk.text);
      docs.push({
        content: chunk.text,
        embedding: emb.embedding.values,
        metadata: {
          sourceTitle: title,
          category,
          heading: chunk.heading,
          addedBy: ADMIN_EMAIL,
          createdAt: new Date(),
        },
      });
    }

    if (docs.length > 0) {
      await collection.insertMany(docs);
    }

    return NextResponse.json({ success: true, count: docs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}