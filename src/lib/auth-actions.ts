"use server";

import { AuthError } from "next-auth";
import { getEnabledProviders, signIn, signOut } from "@/lib/auth";
import { createUser, credentialsSchema, registerSchema } from "@/lib/users";

/** Разрешаем только внутренние пути, чтобы не было открытых редиректов. */
function safePath(path: unknown): string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export type AuthFormError = "invalid" | "weakPassword" | "exists" | "credentials" | "server";

export interface AuthFormState {
  error?: AuthFormError;
}

export async function signInWithProvider(
  providerId: string,
  redirectTo: string,
): Promise<void> {
  const allowed = getEnabledProviders().some((p) => p.id === providerId);
  if (!allowed) throw new Error("Провайдер входа не настроен");
  await signIn(providerId, { redirectTo: safePath(redirectTo) });
}

/** signIn при успехе бросает служебный redirect, его нужно пропустить дальше. */
async function signInWithPassword(email: string, password: string, redirectTo: string) {
  try {
    await signIn("credentials", { email, password, redirectTo });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: "credentials" as const };
    throw error;
  }
}

export async function loginAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "credentials" };

  return signInWithPassword(parsed.data.email, parsed.data.password, safePath(form.get("redirectTo")));
}

export async function registerAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === "password");
    return { error: weak ? "weakPassword" : "invalid" };
  }

  try {
    if ((await createUser(parsed.data)) === "exists") return { error: "exists" };
  } catch (error) {
    console.error("[auth] Ошибка регистрации:", error);
    return { error: "server" };
  }

  return signInWithPassword(parsed.data.email, parsed.data.password, safePath(form.get("redirectTo")));
}

export async function signOutAction(redirectTo: string): Promise<void> {
  await signOut({ redirectTo: safePath(redirectTo) });
}
