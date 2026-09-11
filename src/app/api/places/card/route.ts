import { NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { googleMapsApiKey } from "@/server/places/google-key";
import { placeCardFor } from "@/server/places/place-card";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";

/**
 * A card is asked for once per place opened, and a person opens a handful of
 * places in a sitting. Anything asking more often is not a person.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 30 };

const ROUTE = "places-card";

const querySchema = z.object({
  slug: z.string().min(1).max(80),
  id: z.string().min(1).max(300),
});

/**
 * What a place on a trip is like. A read, so no edit key is asked for: anyone
 * holding the plain link may look. The place has to be on the trip named,
 * which is what stops this being a way to look up any place in the world on
 * our account.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many places opened from this connection.",
        action: `Wait ${String(limit.retryAfterSeconds)} seconds and open it again.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return NextResponse.json(
      { error: "Place details are not switched on for this server." },
      { status: 503 },
    );
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
  }

  const { slug, id } = parsed.data;
  const onTrip = await prismaTripRepository.findPlaceByProviderId(slug, id);
  if (onTrip === null) {
    return NextResponse.json({ error: "That place is not on this trip." }, { status: 404 });
  }

  try {
    const card = await placeCardFor(id, createGooglePlacesProvider({ apiKey }));
    if (card === null) {
      return NextResponse.json(
        { error: "Nothing more is known about this place." },
        { status: 404 },
      );
    }
    return NextResponse.json({ card });
  } catch (cause) {
    console.error("Place card failed", cause);
    return NextResponse.json(
      {
        error: "Could not reach the place service.",
        action: "Your trip is saved, try again in a moment.",
      },
      { status: 502 },
    );
  }
}
