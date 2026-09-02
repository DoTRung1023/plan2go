import { NextResponse } from "next/server";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { openTrip } from "@/server/trips/open-trip";

/** Writes a trip and a cookie, so there is nothing here to cache. */
export const dynamic = "force-dynamic";

/**
 * Starting another trip, from the button inside one.
 *
 * A form post rather than a server action, because the button opens the new
 * trip in its own tab: a browser opens a tab for a form it was asked to submit,
 * while a window opened from code after an await is a popup and gets blocked.
 * It also means the button works before the page has hydrated.
 *
 * A post, never a get, because a link that creates a trip would be followed by
 * every crawler and prefetcher that sees it. The redirect is 303 so the new tab
 * asks for the trip with a get rather than posting to it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const opened = await openTrip(request.headers, prismaTripRepository);

  if (opened.status === "too-many") {
    return new NextResponse(
      `Too many new trips have been started from this connection. Wait ${String(opened.retryAfterSeconds)} seconds and start another one.\n`,
      {
        status: 429,
        headers: {
          "Retry-After": String(opened.retryAfterSeconds),
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }

  return NextResponse.redirect(new URL(`/t/${opened.slug}`, request.url), 303);
}
