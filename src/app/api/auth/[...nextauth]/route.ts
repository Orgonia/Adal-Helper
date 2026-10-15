import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getDb } from "@/lib/mongodb";

export const authOptions: any = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Этот метод вызывается ДО создания сессии при успешном логине Google
    async signIn({ user, account }: any) {
      if (!user || !user.email) return false;

      try {
        const db = await getDb();
        const usersCollection = db.collection("users");
        
        // Вручную сохраняем или обновляем пользователя в MongoDB
        await usersCollection.updateOne(
          { email: user.email },
          {
            $set: {
              name: user.name,
              email: user.email,
              image: user.image,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            }
          },
          { upsert: true }
        );

      } catch (error) {
        console.error("Ошибка сохранения в БД во время signIn:", error);
      }
      return true;
    },
    
    // Переносим ID из БД (почту) в токен
    async jwt({ token, user }: any) {
      if (user) {
        token.sub = user.email; // Используем email как уникальный идентификатор
      }
      return token;
    },
    
    // Передаем данные из токена в сессию для фронтенда
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub; 
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };