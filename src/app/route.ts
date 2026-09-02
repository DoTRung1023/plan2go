import { redirect } from "next/navigation";
import { hashEditToken } from "@/server/ownership/edit-token";
import { readEditToken } from "@/server/ownership/edit-token-cookie";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { openTrip } from "@/server/trips/open-trip";

/** Reads a cookie and writes a trip, so there is nothing here to cache. */
export const dynamic = "force-dynamic";

/**
 * The front door. There is no page in front of the planner, so opening the site
 * puts you inside one.
 *
 * A browser that already holds an edit token goes back to the trip that token
 * belongs to instead of starting another. There is one token per browser, so
 * creating on every visit would mean a refresh or a click on the logo quietly
 * stranding the trip you were just editing without its token. Starting another
 * one on purpose is a button inside the planner, which says what it costs.
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

  const opened = await openTrip(request.headers, prismaTripRepository);
  if (opened.status === "too-many") {
    return new Response(
      `Too many new trips have been started from this connection. Wait ${String(opened.retryAfterSeconds)} seconds and open the page again.\n`,
      {
        status: 429,
        headers: {
          "Retry-After": String(opened.retryAfterSeconds),
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }

  redirect(`/t/${opened.slug}`);
}
