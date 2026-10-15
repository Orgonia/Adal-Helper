"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Языки распознавания и синтеза для локалей сайта. */
const SPEECH_LANG: Record<string, string> = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" };

// Web Speech API нет в стандартных типах TypeScript, описываем минимально
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/** Поддержка проверяется только в браузере, на сервере всегда false. */
function useBrowserSupport(check: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, check, () => false);
}

export type DictationError = "denied" | "failed";

/**
 * Голосовой ввод. onText получает распознанный текст по мере диктовки:
 * final = true для окончательного фрагмента.
 */
export function useDictation(
  locale: string,
  onText: (text: string, final: boolean) => void,
  onError: (error: DictationError) => void,
) {
  const supported = useBrowserSupport(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTextRef.current = onText;
    onErrorRef.current = onError;
  }, [onText, onError]);

  useEffect(() => () => recRef.current?.abort(), []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recRef.current) return;

    const rec = new Ctor();
    rec.lang = SPEECH_LANG[locale] ?? "ru-RU";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onTextRef.current(r[0].transcript, true);
        else interim += r[0].transcript;
      }
      if (interim) onTextRef.current(interim, false);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      onErrorRef.current(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "failed");
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      onErrorRef.current("failed");
    }
  }, [locale]);

  return { supported, listening, start, stop };
}

/** Убираем разметку Markdown, чтобы синтезатор не читал символы. */
function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>|~]+/g, " ")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Озвучивание ответа встроенным синтезатором речи браузера. */
export function useSpeaker(locale: string) {
  const supported = useBrowserSupport(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [speaking, setSpeaking] = useState(false);

  useEffect(
    () => () => {
      if (speaking) window.speechSynthesis.cancel();
    },
    [speaking],
  );

  const toggle = useCallback(
    (markdown: string) => {
      const synth = window.speechSynthesis;
      if (speaking) {
        synth.cancel();
        setSpeaking(false);
        return;
      }
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(plainText(markdown).slice(0, 4000));
      const lang = SPEECH_LANG[locale] ?? "ru-RU";
      utter.lang = lang;
      // Голос нужного языка, если он установлен в системе
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
      if (voice) utter.voice = voice;
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utter);
    },
    [locale, speaking],
  );

  return { supported, speaking, toggle };
}
