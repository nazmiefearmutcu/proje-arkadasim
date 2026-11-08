import { PrismaClient } from "@prisma/client";

// Geliştirmede hot reload her çağrıda yeni istemci açmasın diye globalde önbellekle.
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.__prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = db;
}
