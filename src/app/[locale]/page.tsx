import { setRequestLocale } from "next-intl/server";
import { ChatContainer } from "@/components/chat/chat-container";
import { getSession } from "@/lib/auth";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();

  return (
    <div className="relative isolate h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(56,189,248,0.12),transparent),radial-gradient(40%_30%_at_85%_100%,rgba(252,211,77,0.06),transparent)]"
      />
      <main className="h-full w-full">
        <ChatContainer signedIn={!!session?.user?.id} />
      </main>
    </div>
  );
}
