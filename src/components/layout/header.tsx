import { Info, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { Link } from "@/i18n/navigation";
import { getSession, isAdminEmail } from "@/lib/auth";

export async function Header() {
  const t = await getTranslations("header");
  const session = await getSession();

  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        isAdmin: isAdminEmail(session.user.email),
      }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-50">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-amber-300 text-zinc-950">
            <Scale className="size-4" />
          </span>
          {t("brand")}
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/about"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            <Info className="size-4" />
            <span className="hidden sm:inline">{t("about")}</span>
          </Link>
          <LanguageSwitcher />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
