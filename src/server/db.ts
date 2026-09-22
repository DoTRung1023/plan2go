import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

/**
 * The pooled connection string, read here and nowhere else. The schema names
 * it too, for the CLI pushing schema changes, but at run time the adapter
 * below owns the connection and Prisma no longer reads the environment.
 */
function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === "") {
    throw new Error("DATABASE_URL is not set. Put the pooled Neon connection string in .env.");
  }
  return url;
}

/**
 * One client per process. Next reloads modules in development, so the instance
 * is parked on globalThis to stop the connection pool growing on every edit.
 *
 * The adapter is Neon's own driver, which speaks to the database over a
 * WebSocket rather than a native engine: nothing to load on a cold start, and
 * Node 24 brings its own WebSocket, so nothing else to install either.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl() }) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
