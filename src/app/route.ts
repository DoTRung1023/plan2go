import { redirect } from "next/navigation";
import { hashEditToken } from "@/server/ownership/edit-token";
import { readEditToken, setEditToken } from "@/server/ownership/edit-token-cookie";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { createTrip } from "@/server/trips/create-trip";
import { openingTimeZone, todayIn } from "@/server/trips/time-zones";

/** Reads a cookie and writes a trip, so there is nothing here to cache. */
export const dynamic = "force-dynamic";

/**
 * Set against a script opening trips in a loop, not against a household. Only
 * the branch that writes is counted: someone coming back to a trip they already
 * hold the token for is a read, and must never be turned away from their own
 * trip because the office they are in shares an address.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 3600, maxRequests: 30 };

const ROUTE = "open-trip";

/** What a trip is called until the traveller names it. */
const UNTITLED = "Untitled trip";

/**
 * How far the last day sits from the first when a trip opens. Changed in the
 * trip details, along with everything else.
 */
const OPENING_SPAN_DAYS = 5;

/**
 * The front door. There is no page in front of the planner, so opening the site
 * puts you inside one.
 *
 * A browser that already holds an edit token goes back to the trip that token
 * belongs to instead of starting another. There is one token per browser, so
 * creating on every visit would mean a refresh or a click on the logo quietly
 * stranding the trip you were just editing without its token.
 */
export async function GET(request: Request): Promise<Response> {
  const presented = await readEditToken();
  if (presented !== null) {
    const held = await prismaTripRepository.findSlugByEditTokenHash(
      hashEditToken(presented),
    );
    if (held !== null) {
      redirect(`/t/${held}`);
    }
  }

  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return new Response(
      `Too many new trips have been started from this connection. Wait ${String(limit.retryAfterSeconds)} seconds and open the page again.\n`,
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }

  const timeZone = openingTimeZone(request.headers);
  const { slug, editToken } = await createTrip(
    {
      title: UNTITLED,
      timeZone,
      startDate: todayIn(timeZone),
      // A span of five days is six days counted, the first one included.
      dayCount: OPENING_SPAN_DAYS + 1,
    },
    prismaTripRepository,
  );
  await setEditToken(editToken);
  redirect(`/t/${slug}`);
}
