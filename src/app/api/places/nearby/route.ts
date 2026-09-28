import { NextResponse } from "next/server";
import { z } from "zod";
import { PLACE_KINDS } from "@/core/model/place-kind";
import { recommendPlaces } from "@/server/places/recommend-places";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { placesRead } from "../places-read";

/**
 * Asked once when the field is opened and once for each quick search pressed,
 * rather than once per few letters, and there are ten quick searches, so a
 * reader looking through them all in a minute comes nowhere near this. A
 * script asking for every kind in every city does.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 30 };

/** As many as the provider will name for one question. */
const MOST_ASKED = 20;

const querySchema = z.object({
  /**
   * One of the fixed kinds and nothing typed, so every answer is one worth
   * keeping; none for what the city is known for, of any kind.
   */
  kind: z.enum(PLACE_KINDS).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(MOST_ASKED).default(6),
});

/**
 * The best known places in the city a trip is in, of one kind or of any. A
 * read, and the coordinates are the trip's own centre rather than anything
 * the reader chose, so there is nothing here worth guarding beyond the spend.
 */
export const GET = placesRead({
  route: "places-nearby",
  policy: POLICY,
  query: querySchema,
  failing: "Nearby places failed",
  answer: async ({ kind, lat, lng, limit }, provider) =>
    NextResponse.json({
      suggestions: await recommendPlaces(kind ?? null, { lat, lng }, limit, provider),
    }),
});
