"use client";

import { LoaderCircle, Lock, Mail, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, type ComponentType } from "react";
import { loginAction, registerAction, type AuthFormState } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

type Tab = "signin" | "register";

function Field({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: ComponentType<{ className?: string }> }) {
  return (
    <label className="relative block">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
      <input
        {...props}
        className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950 pl-10 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
      />
    </label>
  );
}

export function AuthForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations("login");
  const [tab, setTab] = useState<Tab>("signin");
  const [loginState, login, loginPending] = useActionState<AuthFormState, FormData>(loginAction, {});
  const [registerState, register, registerPending] = useActionState<AuthFormState, FormData>(
    registerAction,
    {},
  );

  const state = tab === "signin" ? loginState : registerState;
  const pending = tab === "signin" ? loginPending : registerPending;

  return (
    <div>
      <div role="tablist" className="grid grid-cols-2 rounded-xl border border-white/10 bg-zinc-950 p-1">
        {(["signin", "register"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-lg py-2 text-sm font-medium transition",
              tab === value ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t(value === "signin" ? "tabSignIn" : "tabRegister")}
          </button>
        ))}
      </div>

      <form key={tab} action={tab === "signin" ? login : register} className="mt-4 space-y-3">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        {tab === "register" && (
          <Field icon={User} name="name" autoComplete="name" required maxLength={60} placeholder={t("name")} />
        )}
        <Field icon={Mail} name="email" type="email" autoComplete="email" required maxLength={254} placeholder={t("email")} />
        <Field
          icon={Lock}
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete={tab === "signin" ? "current-password" : "new-password"}
          placeholder={t(tab === "register" ? "passwordHint" : "password")}
        />

        {state.error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {t(`errors.${state.error}`)}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {t(tab === "signin" ? "submitSignIn" : "submitRegister")}
        </button>
      </form>
    </div>
  );
}
