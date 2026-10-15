import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/auth/auth-form";
import { GitHubIcon, GoogleIcon } from "@/components/layout/provider-icons";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getEnabledProviders, getSession } from "@/lib/auth";
import { signInWithProvider } from "@/lib/auth-actions";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);

  const session = await getSession();
  if (session?.user) redirect({ href: "/", locale: locale as Locale });

  const t = await getTranslations("login");
  const providers = getEnabledProviders();
  const home = `/${locale}`;

  const errorText = error
    ? error === "OAuthAccountNotLinked"
      ? t("errorLinked")
      : t("error")
    : null;

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-zinc-400">{t("subtitle")}</p>

        {errorText && (
          <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {errorText}
          </p>
        )}

        {providers.length > 0 && (
          <div className="mt-6 space-y-3">
            {providers.map((p) => (
              <form key={p.id} action={signInWithProvider.bind(null, p.id, home)}>
                <Button
                  type="submit"
                  variant="outline"
                  className="h-11 w-full gap-2.5 border-white/10 bg-zinc-950 text-zinc-100 hover:bg-zinc-800 hover:text-white"
                >
                  {p.id === "google" ? <GoogleIcon className="size-5" /> : <GitHubIcon className="size-5" />}
                  {p.id === "google" ? t("google") : t("github")}
                </Button>
              </form>
            ))}
            <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wide text-zinc-500">
              <span className="h-px flex-1 bg-white/10" />
              {t("or")}
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </div>
        )}

        <div className={providers.length > 0 ? "mt-1" : "mt-6"}>
          <AuthForm redirectTo={home} />
        </div>

        <Button asChild variant="ghost" className="mt-4 w-full text-zinc-400 hover:bg-white/5 hover:text-white">
          <Link href="/">{t("continueAsGuest")}</Link>
        </Button>

        <p className="mt-3 text-center text-[11px] leading-snug text-zinc-500">{t("privacy")}</p>
      </div>
    </main>
  );
}
