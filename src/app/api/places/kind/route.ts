import { NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { PLACE_KINDS } from "@/core/model/place-kind";
import { googleMapsApiKey } from "@/server/places/google-key";
import { placesOfKind } from "@/server/places/recommend-places";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";

/**
 * Asked once for each press of a quick search, and there are ten of them, so
 * a reader looking through them all in a minute comes nowhere near this. A
 * script asking for every kind in every city does.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 30 };

const ROUTE = "places-kind";

/** As many as the provider will name for one question. */
const MOST_ASKED = 20;

const querySchema = z.object({
  /** One of the fixed kinds and nothing typed, so every answer is one worth keeping. */
  kind: z.enum(PLACE_KINDS),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(MOST_ASKED).default(10),
});

/**
 * The places of one kind in the city a trip is in, "parks in Hanoi". A read,
 * so no edit token is asked for, and the kind is one of a fixed few, so the
 * only thing here worth guarding is the spend.
 *
 * Unlike the city's recommendations this was asked for out loud, with a
 * press, so a refusal says what happened and what to do, for the panel to
 * show in place of the list.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many searches from this connection.",
        action: `Wait ${String(limit.retryAfterSeconds)} seconds and try again.`,
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
    return NextResponse.json(
      { error: "That search could not be read.", action: "Choose a quick search again." },
      { status: 400 },
    );
  }

  const { kind, lat, lng, limit: size } = parsed.data;
  try {
    const suggestions = await placesOfKind(
      kind,
      { lat, lng },
      size,
      createGooglePlacesProvider({ apiKey }),
    );
    return NextResponse.json({ suggestions });
  } catch (cause) {
    // Kept in the function log so an upstream outage is diagnosable, and turned
    // into a sentence that says what the reader should do about it.
    console.error("Places of a kind failed", cause);
    return NextResponse.json(
      {
        error: "Could not reach the place search service.",
        action: "Your trip is saved, try again in a moment.",
      },
      { status: 502 },
    );
  }
}
