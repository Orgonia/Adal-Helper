import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// В Next.js 16 файл middleware.ts переименован в proxy.ts.
// Здесь только маршрутизация языков: проверка сессии делается на сервере.
export default createMiddleware(routing);

export const config = {
  // Все пути, кроме api, служебных путей Next.js и файлов с расширением
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
