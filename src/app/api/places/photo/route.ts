import { NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { googleMapsApiKey } from "@/server/places/google-key";
import { placePhotoFor } from "@/server/places/place-photo";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";

/** A sheet draws six pictures, and a person opens a handful of places in a sitting. */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 180 };

const ROUTE = "places-photo";

/** The two widths the sheet draws: the picture across the top, and the strip under it. */
const WIDTHS = [800, 320] as const;

/** As many as a card holds. */
const MOST_PHOTOS = 10;

const querySchema = z.object({
  slug: z.string().min(1).max(80),
  id: z.string().min(1).max(300),
  at: z.coerce.number().int().min(0).max(MOST_PHOTOS - 1),
  width: z.coerce.number().int().refine((value) => WIDTHS.some((width) => width === value)),
});

/**
 * One picture of a place on a trip, served from here so the key never reaches
 * the browser. The browser may keep it for the day; our own table keeps it
 * for the month the terms allow, so a picture is paid for once however many
 * times the place is opened.
 */
export async function GET(request: Request): Promise<Response> {
  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return new Response(null, { status: 503 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }

  const { slug, id, at, width } = parsed.data;
  const onTrip = await prismaTripRepository.findPlaceByProviderId(slug, id);
  if (onTrip === null) {
    return new Response(null, { status: 404 });
  }

  try {
    const image = await placePhotoFor(id, at, width, createGooglePlacesProvider({ apiKey }));
    if (image === null) {
      return new Response(null, { status: 404 });
    }
    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (cause) {
    console.error("Place photo failed", cause);
    return NextResponse.json({ error: "Could not reach the place service." }, { status: 502 });
  }
}
