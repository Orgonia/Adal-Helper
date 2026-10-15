import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/password";

/** Та же коллекция, что использует @auth/mongodb-adapter для Google/GitHub. */
interface UserDoc {
  _id: ObjectId;
  name?: string | null;
  email: string;
  emailVerified?: Date | null;
  image?: string | null;
  passwordHash?: string;
  createdAt?: Date;
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(128);

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(60),
});

export interface PublicUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

async function usersCollection() {
  return (await getDb()).collection<UserDoc>("users");
}

export type CreateUserResult = "ok" | "exists";

export async function createUser(input: z.infer<typeof registerSchema>): Promise<CreateUserResult> {
  const users = await usersCollection();
  if (await users.findOne({ email: input.email }, { projection: { _id: 1 } })) return "exists";

  try {
    await users.insertOne({
      _id: new ObjectId(),
      name: input.name,
      email: input.email,
      emailVerified: null,
      image: null,
      passwordHash: await hashPassword(input.password),
      createdAt: new Date(),
    });
    return "ok";
  } catch (error) {
    // Уникальный индекс по email (npm run db:index) защищает от гонки
    if ((error as { code?: number }).code === 11000) return "exists";
    throw error;
  }
}

/** Проверка e-mail и пароля. Возвращает null при любой ошибке, не уточняя причину. */
export async function verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
  const users = await usersCollection();
  const user = await users.findOne({ email });

  if (!user?.passwordHash) {
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  return {
    id: user._id.toHexString(),
    name: user.name ?? null,
    email: user.email,
    image: user.image ?? null,
  };
}
