import { NextResponse } from "next/server";
import { z } from "zod";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { placeDetailsFor } from "@/server/places/place-details";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { placesRead, refuse } from "../places-read";

/**
 * A place is looked at once per choice from a search, and a person chooses a
 * handful in a sitting. Anything asking more often is not a person.
 */
const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 30 };

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
export const GET = placesRead({
  route: "places-preview",
  policy: POLICY,
  asking: { many: "places looked at", again: "choose it again", service: "place service" },
  query: querySchema,
  failing: "Place preview failed",
  answer: async ({ slug, key, id, session }, provider) => {
    // A key that is wrong is given the same sentence as a place that is not
    // there: telling them apart would turn this into a way to test keys.
    const access = await checkEditAccess({
      slug,
      presentedKey: key,
      repository: prismaTripRepository,
    });
    const place =
      access.status === "granted" ? await placeDetailsFor(id, provider, session ?? null) : null;
    if (place === null) {
      return refuse(404, "That place could not be found.", "Search for it again.");
    }
    return NextResponse.json({
      place: {
        providerPlaceId: place.providerPlaceId,
        name: place.name,
        address: place.address,
        position: place.position,
      },
    });
  },
});
