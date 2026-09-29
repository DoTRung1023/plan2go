import { after, NextResponse } from "next/server";
import { z } from "zod";
import type { PlaceSearchRequest } from "@/core/ports/places-provider";
import { cachedSearch, keepSearch } from "@/server/places/search-places";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { placesRead } from "../places-read";

/**
 * An open endpoint in front of a metered API. The limit is set to stop a script
 * rather than a person: someone typing behind a debounce will not come close.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 40 };

const querySchema = z.object({
  /** Every field asking this waits for two letters, so fewer is not one of ours. */
  q: z.string().trim().min(2),
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
export const GET = placesRead({
  route: "places-search",
  policy: POLICY,
  asking: { many: "searches", again: "search again", service: "place search service" },
  query: querySchema,
  failing: "Place search failed",
  answer: async ({ q, lat, lng, limit, session, kind }, provider) => {
    const search: PlaceSearchRequest = {
      query: q,
      near: lat === undefined || lng === undefined ? null : { lat, lng },
      limit,
      session: session ?? null,
      only: kind === "city" ? "cities" : null,
    };

    const cached = await cachedSearch(search);
    if (cached !== null) {
      return NextResponse.json({ suggestions: cached });
    }

    const suggestions = await provider.search(search);
    // Kept after the reply has gone, so nobody waits on our own table to be
    // written before seeing the answer. Still finished on the platform, which
    // holds the function open for work handed to it this way.
    after(() => keepSearch(search, suggestions));
    return NextResponse.json({ suggestions });
  },
});
