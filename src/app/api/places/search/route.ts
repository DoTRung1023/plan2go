import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import type { PlaceSearchRequest } from "@/core/ports/places-provider";
import { googleMapsApiKey } from "@/server/places/google-key";
import { cachedSearch, keepSearch } from "@/server/places/search-places";
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
  /** "city" narrows the answers to whole cities, for choosing where a trip is. */
  kind: z.enum(["place", "city"]).default("place"),
});

/**
 * Place search. A read, so no edit token is asked for, but it spends money, so
 * it is limited by address and answered from our own cache when it can be.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const search: PlaceSearchRequest | null = parsed.success
    ? {
        query: parsed.data.q,
        near:
          parsed.data.lat === undefined || parsed.data.lng === undefined
            ? null
            : { lat: parsed.data.lat, lng: parsed.data.lng },
        limit: parsed.data.limit,
        session: parsed.data.session ?? null,
        citiesOnly: parsed.data.kind === "city",
      }
    : null;

  // Counted and looked up in our own table at once rather than one after the
  // other, which is a round trip to the database saved on every search. The
  // table costs nothing to read; the provider, which is paid, is asked only
  // below, once the count has said this request may spend.
  const [limit, cached] = await Promise.all([
    consumeRateLimit(ROUTE, request.headers, POLICY),
    search === null ? null : cachedSearch(search),
  ]);
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

  if (search === null) {
    const first = parsed.error?.issues[0];
    return NextResponse.json(
      {
        error: first === undefined ? "That search could not be read." : first.message,
        action: "Change what you typed and search again.",
      },
      { status: 400 },
    );
  }

  if (cached !== null) {
    return NextResponse.json({ suggestions: cached });
  }

  try {
    const suggestions = await createGooglePlacesProvider({ apiKey }).search(search);
    // Kept after the reply has gone, so nobody waits on our own table to be
    // written before seeing the answer. Still finished on the platform, which
    // holds the function open for work handed to it this way.
    after(() => keepSearch(search, suggestions));
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
