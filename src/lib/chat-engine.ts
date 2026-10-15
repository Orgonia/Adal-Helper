import type { Content, GenerateContentConfig, GenerateContentResponse, Part } from "@google/genai";
import type { Locale } from "@/i18n/routing";
import type { ProcessedAttachments } from "@/lib/attachments";
import { getServerText, type ChatErrorKey } from "@/lib/chat-messages";
import { TOP_K } from "@/lib/config";
import { officialUrl } from "@/lib/documents";
import { getGenAI } from "@/lib/gemini";
import { buildSystemInstruction, buildUserPrompt } from "@/lib/prompts";
import { searchChunks } from "@/lib/rag";
import type { RetrievedChunk } from "@/types";
import type { ChatMode, SourceRef, StreamEvent } from "@/types/chat";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface RunChatParams {
  history: ChatTurn[];
  mode: ChatMode;
  locale: Locale;
  attachments: ProcessedAttachments;
  signal: AbortSignal;
  emit: (event: StreamEvent) => void;
}

export interface ChatOutcome {
  chunks: number;
  webSources: number;
  noData: boolean;
  error?: ChatErrorKey | "kb";
  aborted?: boolean;
}

const MAX_USER_CHARS = 2000;
const MAX_ASSISTANT_CHARS = 4000;
const MAX_WEB_SOURCES = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeHistory(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const content = t.content.slice(0, t.role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS);
    const prev = out[out.length - 1];
    if (prev && prev.role === t.role) prev.content += `\n\n${content}`;
    else out.push({ role: t.role, content });
  }
  while (out.length > 0 && out[0].role === "assistant") out.shift();
  return out;
}

async function buildSearchQuery(history: ChatTurn[]): Promise<string> {
  const users = history.filter((t) => t.role === "user");
  const last = users[users.length - 1]?.content ?? "";
  const prev = users[users.length - 2]?.content;
  const rawQuery = (last.length < 80 && prev ? `${prev}\n${last}` : last).slice(0, 1000);

  try {
    const model = process.env.GEMINI_CHAT_MODEL ?? "gemini-3.8-flash";
    const response = await getGenAI().models.generateContent({
      model,
      contents: rawQuery,
      config: {
        systemInstruction: "You are a translator. Translate the user's input strictly into Russian. Output ONLY the translated text, without quotes, explanations, or introductory phrases.",
      },
    });
    const translated = response.text?.trim();
    return translated || rawQuery;
  } catch {
    return rawQuery;
  }
}

function toDocSources(chunks: RetrievedChunk[]): SourceRef[] {
  const bySource = new Map<string, { ref: SourceRef; headings: string[] }>();
  for (const c of chunks) {
    let entry = bySource.get(c.source);
    if (!entry) {
      entry = {
        ref: { kind: "doc", title: c.title, source: c.source, url: officialUrl(c.source) },
        headings: [],
      };
      bySource.set(c.source, entry);
    }
    const heading = c.heading?.trim().slice(0, 80);
    if (heading && !entry.headings.includes(heading) && entry.headings.length < 3) {
      entry.headings.push(heading);
    }
  }
  return [...bySource.values()].map(({ ref, headings }) =>
    headings.length > 0 ? { ...ref, heading: headings.join("; ") } : ref,
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function describeError(error: unknown): ChatErrorKey {
  const status = (error as { status?: number } | null)?.status;
  if (status === 429) return "rateLimit";
  if (status === 500 || status === 503) return "busy";
  return "generic";
}

const FIRST_CHUNK_TIMEOUT_MS = Number(process.env.GEMINI_FIRST_CHUNK_TIMEOUT_MS ?? 15_000);

function chatModels(): string[] {
  const primary = process.env.GEMINI_CHAT_MODEL ?? "gemini-3.8-flash";
  const fallback = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.1-flash-lite,gemini-flash-lite-latest")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallback])];
}

interface OpenedStream {
  model: string;
  first: IteratorResult<GenerateContentResponse>;
  rest: AsyncIterator<GenerateContentResponse>;
}

async function openStream(
  contents: Content[],
  config: GenerateContentConfig,
  signal: AbortSignal,
): Promise<OpenedStream> {
  const models = chatModels();
  let lastError: unknown;

  for (const [i, model] of models.entries()) {
    const attempt = new AbortController();
    const forwardAbort = () => attempt.abort();
    signal.addEventListener("abort", forwardAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      attempt.abort();
    }, FIRST_CHUNK_TIMEOUT_MS);

    try {
      const stream = await getGenAI().models.generateContentStream({
        model,
        contents,
        config: { ...config, abortSignal: attempt.signal },
      });
      const rest = stream[Symbol.asyncIterator]();
      const first = await rest.next();
      clearTimeout(timer);
      return { model, first, rest };
    } catch (error) {
      clearTimeout(timer);
      signal.removeEventListener("abort", forwardAbort);
      if (signal.aborted) throw error;

      const status = (error as { status?: number } | null)?.status;
      const retryable = timedOut || status === 404 || status === 429 || status === 500 || status === 503;
      lastError = timedOut ? Object.assign(new Error("first chunk timeout"), { status: 503 }) : error;
      if (!retryable) throw error;
      console.warn(`[chat] Модель ${model} недоступна (${timedOut ? "таймаут" : status}), пробую следующую`);
      if (i < models.length - 1) await sleep(300);
    }
  }
  throw lastError;
}

export async function runChat({
  history: rawHistory,
  mode,
  locale,
  attachments,
  signal,
  emit,
}: RunChatParams): Promise<ChatOutcome> {
  const text = getServerText(locale);
  const history = normalizeHistory(rawHistory);
  const question = history[history.length - 1]?.content ?? "";
  const hasAttachments = attachments.count > 0;

  let chunks: RetrievedChunk[] = [];
  let kbUnavailable = false;
  try {
    const searchQuery = await buildSearchQuery(history);
    const result = await searchChunks(searchQuery, { limit: TOP_K });
    chunks = result.relevant;
  } catch (error) {
    console.error("[chat] Поиск по базе не удался:", error);
    if (mode === "docs") {
      emit({ type: "error", message: text.errors[describeError(error)] });
      return { chunks: 0, webSources: 0, noData: false, error: "kb" };
    }
    kbUnavailable = true;
  }

  if (mode === "docs" && chunks.length === 0 && !hasAttachments) {
    emit({ type: "delta", text: text.noData });
    emit({ type: "done" });
    return { chunks: 0, webSources: 0, noData: true };
  }

  const docSources = toDocSources(chunks);
  if (docSources.length > 0) emit({ type: "sources", sources: docSources });

  const promptOptions = {
    mode,
    locale,
    today: new Date().toISOString().slice(0, 10),
    hasChunks: chunks.length > 0,
    hasAttachments,
    kbUnavailable,
  };
  const config: GenerateContentConfig = {
    systemInstruction: buildSystemInstruction(promptOptions),
    temperature: mode === "docs" ? 0.1 : 0.4,
    maxOutputTokens: 8192,
  };
  if (mode === "web") config.tools = [{ googleSearch: {} }];

  const budget = process.env.GEMINI_THINKING_BUDGET;
  if (budget && Number.isFinite(Number(budget))) {
    config.thinkingConfig = { thinkingBudget: Number(budget) };
  }

  const lastParts: Part[] = [
    { text: buildUserPrompt({ question, chunks, texts: attachments.texts }) },
    ...attachments.parts,
  ];
  const contents: Content[] = [
    ...history.slice(0, -1).map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    })),
    { role: "user", parts: lastParts },
  ];

  try {
    let opened: OpenedStream;
    try {
      opened = await openStream(contents, config, signal);
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (mode !== "web" || status !== 429 || signal.aborted) throw error;
      if (chunks.length === 0 && !hasAttachments) {
        emit({ type: "error", message: text.webUnavailable });
        return { chunks: 0, webSources: 0, noData: false, error: "rateLimit" };
      }
      console.warn("[chat] Поиск Google недоступен (429), отвечаю по базе документов");
      emit({ type: "delta", text: `${text.webFallback}\n\n` });
      opened = await openStream(
        contents,
        {
          ...config,
          tools: undefined,
          temperature: 0.1,
          systemInstruction: buildSystemInstruction({ ...promptOptions, mode: "docs" }),
        },
        signal,
      );
    }
    const { first, rest } = opened;

    let produced = false;
    const web = new Map<string, SourceRef>();

    for (let next = first; !next.done; next = await rest.next()) {
      const chunk = next.value;
      for (const g of chunk.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
        const uri = g.web?.uri;
        if (!uri || web.has(uri) || web.size >= MAX_WEB_SOURCES || !/^https?:\/\//i.test(uri)) continue;
        web.set(uri, {
          kind: "web",
          title: g.web?.title || hostnameOf(uri),
          source: uri,
          url: uri,
        });
      }

      const delta = chunk.text;
      if (delta) {
        produced = true;
        emit({ type: "delta", text: delta });
      }
    }

    if (!produced) {
      emit({ type: "error", message: text.errors.empty });
      return { chunks: chunks.length, webSources: web.size, noData: false, error: "empty" };
    }
    if (web.size > 0) {
      emit({ type: "sources", sources: [...docSources, ...web.values()] });
    }
    emit({ type: "done" });
    return { chunks: chunks.length, webSources: web.size, noData: false };
  } catch (error) {
    if (signal.aborted) return { chunks: chunks.length, webSources: 0, noData: false, aborted: true };
    console.error("[chat] Ошибка Gemini:", error);
    const key = describeError(error);
    emit({ type: "error", message: text.errors[key] });
    return { chunks: chunks.length, webSources: 0, noData: false, error: key };
  }
}