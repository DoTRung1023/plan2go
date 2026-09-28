import { NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { googleMapsApiKey } from "@/server/places/google-key";
import { citiesToVisit } from "@/server/places/cities-to-visit";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";

/**
 * As tight as the nearby places are held to, for the same reason: this is
 * asked once when the city picker opens, not once per few letters, so a
 * person reaches it a handful of times in a sitting.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 10 };

const ROUTE = "places-cities";

/**
 * The towns near a city and the cities in its country come to twenty at
 * most, and more than that would be names nobody scrolls to.
 */
const MOST_ASKED = 20;

const querySchema = z.object({
  city: z.string().min(1).max(300),
  limit: z.coerce.number().int().min(1).max(MOST_ASKED).default(MOST_ASKED),
});

/**
 * The cities worth going to from a day's city, the towns near it and the best
 * known cities in its country, nearest first, each with how far it is and
 * which way. A read, so no edit token is asked for, and the city is a
 * provider identifier that says nothing about anybody, so there is nothing
 * here to guard beyond the spend.
 *
 * Every refusal is a plain one. Nothing here was asked for out loud: the
 * reader opened the city picker, and a sentence explaining why a list they
 * never requested is missing would be noise. The picker shows nothing instead.
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

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    const cities = await citiesToVisit(
      parsed.data.city,
      parsed.data.limit,
      createGooglePlacesProvider({ apiKey }),
    );
    if (cities === null) {
      return NextResponse.json({ error: "That city could not be found." }, { status: 404 });
    }
    return NextResponse.json({ cities });
  } catch (cause) {
    console.error("Cities to visit failed", cause);
    return NextResponse.json(
      { error: "Could not reach the place search service." },
      { status: 502 },
    );
  }
}
