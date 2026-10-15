"use client";

import { Activity, LogIn, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/lib/auth-actions";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin?: boolean;
  } | null;
}

function initials(name?: string | null, email?: string | null): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function UserMenu({ user }: UserMenuProps) {
  const t = useTranslations("header");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  if (!user) {
    return (
      <Button
        asChild
        size="sm"
        className="gap-1.5 bg-sky-500 text-zinc-950 hover:bg-sky-400"
      >
        <Link href="/login">
          <LogIn className="size-4" />
          {t("signIn")}
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-sky-400/60 transition focus-visible:ring-2"
          aria-label={user.name ?? user.email ?? "Account"}
        >
          <Avatar className="size-8">
            <AvatarImage
              src={user.image ?? undefined}
              alt={user.name ?? ""}
              referrerPolicy="no-referrer"
            />
            <AvatarFallback className="bg-zinc-800 text-xs text-zinc-200">
              {initials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 border-white/10 bg-zinc-900 text-zinc-100">
        <DropdownMenuLabel className="space-y-0.5">
          {user.name && <p className="truncate text-sm font-medium">{user.name}</p>}
          {user.email && <p className="truncate text-xs font-normal text-zinc-400">{user.email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {user.isAdmin && (
          <DropdownMenuItem asChild className="gap-2">
            <Link href="/stats">
              <Activity className="size-4" />
              {t("stats")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={pending}
          onSelect={() => startTransition(() => signOutAction(`/${locale}`))}
          className="gap-2"
        >
          <LogOut className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
