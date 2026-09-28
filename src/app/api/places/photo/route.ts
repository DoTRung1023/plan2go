import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { googleMapsApiKey } from "@/server/places/google-key";
import { placePhotoFor } from "@/server/places/place-photo";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";

/** A sheet draws ten pictures, and a person opens a handful of places in a sitting. */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 300 };

const ROUTE = "places-photo";

/**
 * The widths the sheet draws: the picture across the top, the strip under
 * it, and one opened to fill the window, which is asked for only when it is
 * and at whichever of two densities the screen looking at it has.
 */
const WIDTHS = [4800, 3200, 1600, 800, 320] as const;

/** As many as a card holds. */
const MOST_PHOTOS = 10;

const querySchema = z.object({
  slug: z.string().min(1).max(80),
  id: z.string().min(1).max(300),
  at: z.coerce.number().int().min(0).max(MOST_PHOTOS - 1),
  width: z.coerce.number().int().refine((value) => WIDTHS.some((width) => width === value)),
  /** The edit key, from whoever is looking at a place before putting it on the day. */
  key: z.string().min(1).max(200).optional(),
});

/**
 * One picture of a place, served from here so the provider's key never
 * reaches the browser. The browser may keep it for the day; our own table
 * keeps it for the month the terms allow, so a picture is paid for once
 * however many times the place is opened. A place not on the trip is shown
 * to whoever holds the edit key, as its card is.
 *
 * The bytes go out as they come in. A picture at the viewer's size is over a
 * megabyte and the provider hands it over slowly, and the person waiting is
 * looking at a soft copy until the last of it lands, so nothing here holds
 * the stream: not reading it whole first, and not the copy for our own
 * table, which is filled off the same stream and finished after the answer
 * has gone.
 */
export async function GET(request: Request): Promise<Response> {
  // Counted before anything else is read, so a connection over its limit is
  // turned away without costing the database anything more than the count.
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

  const { slug, id, at, width, key } = parsed.data;
  const onTrip = await prismaTripRepository.findPlaceByProviderId(slug, id);
  if (onTrip === null) {
    const access =
      key === undefined
        ? null
        : await checkEditAccess({ slug, presentedKey: key, repository: prismaTripRepository });
    if (access?.status !== "granted") {
      return new Response(null, { status: 404 });
    }
  }

  try {
    const served = await placePhotoFor(id, at, width, createGooglePlacesProvider({ apiKey }));
    if (served === null) {
      return new Response(null, { status: 404 });
    }
    if (served.kept !== null) {
      // Already under way; this only keeps the process alive until it is
      // done, which on a platform that stops a function at its last byte
      // is the difference between a copy kept and a copy paid for again.
      after(served.kept);
    }
    const headers = new Headers({
      "Content-Type": served.image.contentType,
      "Cache-Control": "private, max-age=86400",
    });
    if (served.image.byteLength !== null) {
      // So the browser knows how far along a picture it is drawing softly is.
      headers.set("Content-Length", String(served.image.byteLength));
    }
    return new Response(served.image.body, { headers });
  } catch (cause) {
    console.error("Place photo failed", cause);
    return NextResponse.json({ error: "Could not reach the place service." }, { status: 502 });
  }
}
