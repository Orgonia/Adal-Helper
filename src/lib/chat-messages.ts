import type { Locale } from "@/i18n/routing";

export type ChatErrorKey = "rateLimit" | "busy" | "generic" | "empty";

interface ServerText {
  noData: string;
  /** Поиск в интернете недоступен, ответ дан по базе документов */
  webFallback: string;
  /** Поиск в интернете недоступен, а в базе ответа нет */
  webUnavailable: string;
  errors: Record<ChatErrorKey, string>;
}

const TEXTS: Record<Locale, ServerText> = {
  ru: {
    noData:
      "В базе знаний нет информации по этому вопросу. Я отвечаю только на основе загруженных официальных документов. Попробуйте переформулировать вопрос или включите режим «С интернетом», чтобы поискать шире, но точность таких ответов ниже.",
    webFallback: "> ⚠️ Поиск в интернете сейчас недоступен (исчерпан лимит запросов). Ответ подготовлен только по базе официальных документов.",
    webUnavailable:
      "Поиск в интернете сейчас недоступен (исчерпан лимит запросов), а в базе официальных документов ответа на этот вопрос нет. Попробуйте позже.",
    errors: {
      rateLimit: "Слишком много запросов. Подождите немного и попробуйте снова.",
      busy: "Модель сейчас перегружена. Попробуйте ещё раз через минуту.",
      generic: "Не удалось получить ответ. Попробуйте ещё раз.",
      empty: "Модель не смогла сформировать ответ на этот запрос. Попробуйте переформулировать вопрос.",
    },
  },
  kk: {
    noData:
      "Білім базасында бұл сұрақ бойынша ақпарат жоқ. Мен тек жүктелген ресми құжаттар негізінде жауап беремін. Сұрақты басқаша қойып көріңіз немесе кеңірек іздеу үшін «Интернетпен» режимін қосыңыз, бірақ мұндай жауаптардың дәлдігі төмен.",
    webFallback: "> ⚠️ Интернеттен іздеу қазір қолжетімсіз (сұраулар лимиті таусылды). Жауап тек ресми құжаттар базасы бойынша дайындалды.",
    webUnavailable:
      "Интернеттен іздеу қазір қолжетімсіз (сұраулар лимиті таусылды), ал ресми құжаттар базасында бұл сұраққа жауап жоқ. Кейінірек қайталап көріңіз.",
    errors: {
      rateLimit: "Сұраулар тым көп. Біраз күтіп, қайталап көріңіз.",
      busy: "Модель қазір шамадан тыс жүктелген. Бір минуттан кейін қайталап көріңіз.",
      generic: "Жауап алу мүмкін болмады. Қайталап көріңіз.",
      empty: "Модель бұл сұрауға жауап қалыптастыра алмады. Сұрақты басқаша қойып көріңіз.",
    },
  },
  en: {
    noData:
      "The knowledge base has no information on this question. I answer only from the uploaded official documents. Try rephrasing, or switch on the “With web search” mode to search more widely, though such answers are less accurate.",
    webFallback: "> ⚠️ Web search is unavailable right now (request limit reached). This answer is based only on the official documents in the knowledge base.",
    webUnavailable:
      "Web search is unavailable right now (request limit reached), and the official documents in the knowledge base do not answer this question. Please try again later.",
    errors: {
      rateLimit: "Too many requests. Please wait a moment and try again.",
      busy: "The model is overloaded right now. Please try again in a minute.",
      generic: "Could not get a response. Please try again.",
      empty: "The model could not produce an answer to this request. Try rephrasing your question.",
    },
  },
};

export function getServerText(locale: Locale): ServerText {
  return TEXTS[locale] ?? TEXTS.ru;
}
