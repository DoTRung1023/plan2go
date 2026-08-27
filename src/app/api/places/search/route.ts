import { NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { googleMapsApiKey } from "@/server/places/google-key";
import { searchPlaces } from "@/server/places/search-places";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";

/**
 * An open endpoint in front of a metered API. The limit is set to stop a script
 * rather than a person: someone typing behind a debounce will not come close.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 40 };

const ROUTE = "places-search";

const querySchema = z.object({
  q: z.string().trim().min(2, "Type at least two letters to search."),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(5),
  session: z.string().min(1).max(64).optional(),
});

/**
 * Place search. A read, so no edit token is asked for, but it spends money, so
 * it is limited by address and answered from our own cache when it can be.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many searches from this connection.",
        action: `Wait ${String(limit.retryAfterSeconds)} seconds and search again.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return NextResponse.json(
      {
        error: "Place search is not switched on for this server.",
        action: "Add a stop by dropping a pin on the map.",
      },
      { status: 503 },
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: first === undefined ? "That search could not be read." : first.message,
        action: "Change what you typed and search again.",
      },
      { status: 400 },
    );
  }

  const { q, lat, lng, limit: size, session } = parsed.data;
  const near = lat === undefined || lng === undefined ? null : { lat, lng };

  try {
    const suggestions = await searchPlaces(
      { query: q, near, limit: size, session: session ?? null },
      createGooglePlacesProvider({ apiKey }),
    );
    return NextResponse.json({ suggestions });
  } catch (cause) {
    // Kept in the function log so an upstream outage is diagnosable, and turned
    // into a sentence that says what the reader should do about it.
    console.error("Place search failed", cause);
    return NextResponse.json(
      {
        error: "Could not reach the place search service.",
        action: "Your trip is saved, try again in a moment.",
      },
      { status: 502 },
    );
  }
}
