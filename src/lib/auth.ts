import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { unstable_rethrow } from "next/navigation";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { getClientPromise } from "@/lib/mongodb";
import { checkRateLimit } from "@/lib/rate-limit";
import { credentialsSchema, verifyCredentials } from "@/lib/users";

export interface EnabledProvider {
  id: "google" | "github";
  name: string;
}

/** OAuth-провайдеры включаются автоматически, если в .env заданы их ключи. */
export function getEnabledProviders(): EnabledProvider[] {
  const list: EnabledProvider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    list.push({ id: "google", name: "Google" });
  }
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    list.push({ id: "github", name: "GitHub" });
  }
  return list;
}

/** Попыток входа по паролю на один e-mail за 5 минут (защита от перебора). */
const LOGIN_ATTEMPTS_PER_5_MIN = 10;

const credentials = Credentials({
  id: "credentials",
  credentials: { email: {}, password: {} },
  async authorize(raw) {
    const parsed = credentialsSchema.safeParse(raw);
    if (!parsed.success) return null;

    const { email, password } = parsed.data;
    const rate = await checkRateLimit(`login:${email}`, LOGIN_ATTEMPTS_PER_5_MIN, 300);
    if (!rate.ok) return null;

    return verifyCredentials(email, password);
  },
});

function buildProviders(): Provider[] {
  // Google и GitHub сами читают AUTH_GOOGLE_ID/SECRET и AUTH_GITHUB_ID/SECRET.
  // Google подтверждает e-mail, поэтому разрешаем привязать вход через Google
  // к аккаунту, ранее зарегистрированному по почте.
  const oauth = getEnabledProviders().map((p) =>
    p.id === "google" ? Google({ allowDangerousEmailAccountLinking: true }) : GitHub,
  );
  return [credentials, ...oauth];
}

// Ленивая инициализация: подключение к MongoDB создаётся при первом запросе,
// а не при импорте модуля (важно для сборки на Vercel).
export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const client = await getClientPromise();

  return {
    adapter: MongoDBAdapter(client, {
      databaseName: process.env.MONGODB_DB ?? "adal_qogam",
    }),
    providers: buildProviders(),
    // Вход по паролю (Credentials) в Auth.js работает только с JWT-сессиями.
    // Пользователи и привязки Google/GitHub по-прежнему хранятся в MongoDB.
    session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
    pages: { signIn: "/login", error: "/login" },
    callbacks: {
      session({ session, token }) {
        if (session.user && token.sub) session.user.id = token.sub;
        return session;
      },
    },
  };
});

/**
 * Безопасное получение сессии: если база недоступна или пользователь
 * не вошёл, сайт продолжает работать в гостевом режиме.
 */
export async function getSession() {
  try {
    return await auth();
  } catch (error) {
    // Служебные исключения Next.js (динамический рендеринг, redirect) пропускаем дальше
    unstable_rethrow(error);
    console.error("[auth] Не удалось получить сессию:", error);
    return null;
  }
}

/** Администраторы (доступ к /stats) задаются через ADMIN_EMAILS через запятую. */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}
