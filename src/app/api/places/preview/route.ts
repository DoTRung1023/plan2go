import { NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { googleMapsApiKey } from "@/server/places/google-key";
import { placeDetailsFor } from "@/server/places/place-details";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";

/**
 * A place is looked at once per choice from a search, and a person chooses a
 * handful in a sitting. Anything asking more often is not a person.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 30 };

const ROUTE = "places-preview";

const querySchema = z.object({
  slug: z.string().min(1).max(80),
  key: z.string().min(1).max(200),
  id: z.string().min(1).max(300),
  /** The search session the place was found under, which this call ends. */
  session: z.string().min(1).max(64).optional(),
});

/**
 * Where a searched place is and what it is called, for looking at it on the
 * map and in the sheet before deciding to put it on the day.
 *
 * Only for whoever holds the edit key: they are the one who can add the
 * place, and could add it and look at it regardless, so this tells them
 * nothing new and costs the same details call the add used to. The answer is
 * kept in our own table for a day, and the add that may follow reads it from
 * there rather than asking the provider again.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many places looked at from this connection.",
        action: `Wait ${String(limit.retryAfterSeconds)} seconds and choose it again.`,
      },
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

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
  }

  const { slug, key, id, session } = parsed.data;
  // A key that is wrong is given the same sentence as a place that is not
  // there: telling them apart would turn this into a way to test keys.
  const access = await checkEditAccess({ slug, presentedKey: key, repository: prismaTripRepository });
  if (access.status !== "granted") {
    return NextResponse.json({ error: "That place could not be found." }, { status: 404 });
  }

  try {
    const place = await placeDetailsFor(id, createGooglePlacesProvider({ apiKey }), session ?? null);
    if (place === null) {
      return NextResponse.json({ error: "That place could not be found." }, { status: 404 });
    }
    return NextResponse.json({
      place: {
        providerPlaceId: place.providerPlaceId,
        name: place.name,
        address: place.address,
        position: place.position,
      },
    });
  } catch (cause) {
    console.error("Place preview failed", cause);
    return NextResponse.json(
      {
        error: "Could not reach the place service.",
        action: "Your trip is saved, try again in a moment.",
      },
      { status: 502 },
    );
  }
}
