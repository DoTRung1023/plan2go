import { PrismaClient } from "@prisma/client";

/**
 * One client per process. Next reloads modules in development, so the instance
 * is parked on globalThis to stop the connection pool growing on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
