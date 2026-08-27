import { createHash } from "node:crypto";
import { db } from "../db";
import type { RateLimitDecision, RateLimitPolicy } from "./window";
import { decide, windowStartFor } from "./window";

/**
 * The address is hashed before it is stored, so our own table is not a log of
 * who visited. The hash is stable, which is all a counter needs.
 */
export function clientKeyFor(address: string): string {
  return createHash("sha256").update(address, "utf8").digest("hex");
}

/**
 * The caller's address. Vercel puts it first in x-forwarded-for. Callers we
 * cannot identify share one bucket, which is the strict direction to fail in.
 */
export function clientAddress(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first === undefined || first === "" ? "unidentified" : first;
}

/**
 * Count this request against the caller's window and say whether it is allowed.
 * Every public route handler calls this before it does any work.
 */
export async function consumeRateLimit(
  route: string,
  headers: Headers,
  policy: RateLimitPolicy,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  const windowStart = windowStartFor(now, policy);
  const clientKey = clientKeyFor(clientAddress(headers));

  const counted = await db.rateLimit.upsert({
    where: { clientKey_route_windowStart: { clientKey, route, windowStart } },
    create: { clientKey, route, windowStart },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  return decide(counted.count, now, windowStart, policy);
}
