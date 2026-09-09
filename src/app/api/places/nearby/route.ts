import { NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { googleMapsApiKey } from "@/server/places/google-key";
import { recommendPlaces } from "@/server/places/recommend-places";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";

/**
 * Tighter than the typed search allows. This is asked once when a field is
 * focused rather than once per few letters, so a person reaches it a handful of
 * times in a sitting and anything asking more often is not one.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 10 };

const ROUTE = "places-nearby";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

/**
 * What the city a trip is in is known for. A read, so no edit token is asked
 * for, and the coordinates are the trip's own centre rather than anything the
 * reader chose, so there is nothing here worth guarding beyond the spend.
 *
 * Every refusal is a plain one. Nothing here was asked for out loud: the reader
 * focused a field, and a sentence explaining why a list they never requested is
 * missing would be noise. The caller shows nothing instead.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests from this connection." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return NextResponse.json(
      { error: "Place search is not switched on for this server." },
      { status: 503 },
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
  }

  const { lat, lng, limit: size } = parsed.data;

  try {
    const suggestions = await recommendPlaces(
      { lat, lng },
      size,
      createGooglePlacesProvider({ apiKey }),
    );
    return NextResponse.json({ suggestions });
  } catch (cause) {
    console.error("Nearby places failed", cause);
    return NextResponse.json(
      { error: "Could not reach the place search service." },
      { status: 502 },
    );
  }
}
